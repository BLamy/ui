/* BL UI — Tailscale request router (service worker). https://blamy.github.io/ui/#/tailscale-router
 *
 * Serve this file from your site's root (copy it to `public/`) and register it with `registerTailscaleRouter` from
 * lib/tailscale-router/bridge. It intercepts the fetches of the pages it controls; the ones that match its policy are
 * handed to a page that is connected to the tailnet (over a MessagePort), and the answer is streamed back. Everything
 * else is left alone: the worker does not call respondWith for it, so the browser handles it as if there were no worker.
 *
 * The policy is read from this script's own URL (`?p=`, written by registerTailscaleRouter), never from a message: it
 * is known the moment the worker wakes up, and changing it means registering a new script. It is the same matching as
 * lib/tailscale-policy.ts (`matchTailscalePolicy`); the two are tested against one set of cases. Classic script, no
 * imports, no build step. MIT licensed, like the rest of BL UI. */
 


(function () {
  const VERSION = 1;
  const PREFIX = 'bl-ts/';
  const sw = self;

  /* ── policy (mirrors lib/tailscale-policy.ts) ── */

  const DEFAULT_POLICY = {
    v: 1, intercept: 'tailnet', hosts: [], cidrs: [], shortNames: false, exclude: [], schemes: ['http', 'https'], methods: null,
    sameOrigin: false, whenUnavailable: 'network', maxBodyBytes: 32 * 1024 * 1024, timeoutMs: 60000, proxyPath: null,
  };

  function parseIPv4(text) {
    const parts = text.split('.');
    if (parts.length !== 4) return null;
    let value = 0n;
    for (let i = 0; i < 4; i++) {
      if (!/^\d{1,3}$/.test(parts[i])) return null;
      const n = Number(parts[i]);
      if (n > 255) return null;
      value = (value << 8n) | BigInt(n);
    }
    return value;
  }

  function parseIPv6(input) {
    let text = input;
    if (!/^[0-9a-f:.]+$/i.test(text) || text.indexOf(':') < 0) return null;
    if (text.lastIndexOf('.') >= 0) {
      const colon = text.lastIndexOf(':');
      const v4 = parseIPv4(text.slice(colon + 1));
      if (v4 === null) return null;
      text = text.slice(0, colon + 1) + (v4 >> 16n).toString(16) + ':' + (v4 & 0xffffn).toString(16);
    }
    const halves = text.split('::');
    if (halves.length > 2) return null;
    const groups = function (s) { return s === '' ? [] : s.split(':'); };
    const head = groups(halves[0]);
    const tail = halves.length === 2 ? groups(halves[1]) : [];
    const missing = 8 - head.length - tail.length;
    if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
    const all = head.concat(halves.length === 2 ? new Array(missing).fill('0') : [], tail);
    let value = 0n;
    for (let i = 0; i < all.length; i++) {
      if (!/^[0-9a-f]{1,4}$/i.test(all[i])) return null;
      value = (value << 16n) | BigInt(parseInt(all[i], 16));
    }
    return value;
  }

  function parseAddress(host) {
    const bare = host.charAt(0) === '[' && host.charAt(host.length - 1) === ']' ? host.slice(1, -1) : host;
    const v4 = parseIPv4(bare);
    if (v4 !== null) return { family: 4, value: v4 };
    const v6 = parseIPv6(bare);
    return v6 !== null ? { family: 6, value: v6 } : null;
  }

  function parseCidr(text) {
    const parts = text.split('/');
    if (parts.length > 2) return null;
    const a = parseAddress(parts[0]);
    if (!a) return null;
    const max = a.family === 4 ? 32 : 128;
    const prefix = parts.length === 1 ? max : /^\d{1,3}$/.test(parts[1]) ? Number(parts[1]) : -1;
    if (prefix < 0 || prefix > max) return null;
    return { family: a.family, value: a.value, prefix: prefix };
  }

  function inCidr(a, c) {
    if (a.family !== c.family) return false;
    const shift = BigInt((a.family === 4 ? 32 : 128) - c.prefix);
    return a.value >> shift === c.value >> shift;
  }

  const TAILNET_V4 = { family: 4, value: (100n << 24n) | (64n << 16n), prefix: 10 };
  const TAILNET_V6 = { family: 6, value: 0xfd7a115ca1e0n << 80n, prefix: 48 };
  const LOOPBACK_V4 = { family: 4, value: 127n << 24n, prefix: 8 };
  const LOOPBACK_V6 = { family: 6, value: 1n, prefix: 128 };

  function matchesPattern(host, pattern) {
    if (pattern.slice(0, 2) === '*.') return host.endsWith(pattern.slice(1));
    if (pattern.charAt(0) === '.') return host === pattern.slice(1) || host.endsWith(pattern);
    return host === pattern;
  }

  function hostIn(host, addr, list) {
    for (let i = 0; i < list.length; i++) {
      const entry = list[i];
      if (entry.indexOf('/') >= 0) {
        const c = parseCidr(entry);
        if (c && addr && inCidr(addr, c)) return true;
      } else if (matchesPattern(host, entry)) return true;
    }
    return false;
  }

  function match(url, method, policy, origin) {
    let u;
    try { u = new URL(url, origin); } catch { return { route: false, reason: 'invalid-url' }; }
    const scheme = u.protocol.slice(0, -1);
    if ((scheme !== 'http' && scheme !== 'https') || policy.schemes.indexOf(scheme) < 0) return { route: false, reason: 'scheme' };
    if (!policy.sameOrigin && origin !== undefined && u.origin === origin) return { route: false, reason: 'same-origin' };
    const host = u.hostname.toLowerCase();
    const addr = parseAddress(host);
    if (host === 'localhost' || host.endsWith('.localhost') || (addr && (inCidr(addr, LOOPBACK_V4) || inCidr(addr, LOOPBACK_V6)))) return { route: false, reason: 'loopback' };
    if (/(^|\.)tailscale\.(com|io)$/.test(host)) return { route: false, reason: 'tailscale' };
    if (policy.methods && policy.methods.indexOf(method.toUpperCase()) < 0) return { route: false, reason: 'method' };
    if (hostIn(host, addr, policy.exclude)) return { route: false, reason: 'excluded' };
    if (policy.intercept === 'all') return { route: true, reason: 'all' };
    if (host.endsWith('.ts.net')) return { route: true, reason: 'tailnet-name' };
    if (addr && (inCidr(addr, TAILNET_V4) || inCidr(addr, TAILNET_V6))) return { route: true, reason: 'tailnet-address' };
    if (hostIn(host, addr, policy.hosts)) return { route: true, reason: 'host' };
    if (hostIn(host, addr, policy.cidrs)) return { route: true, reason: 'cidr' };
    if (policy.shortNames && addr === null && host.indexOf('.') < 0 && host !== '') return { route: true, reason: 'short-name' };
    return { route: false, reason: 'no-match' };
  }

  function readPolicy() {
    try {
      const p = new URL(sw.location.href).searchParams.get('p');
      if (!p) return DEFAULT_POLICY;
      const binary = atob(p.replace(/-/g, '+').replace(/_/g, '/'));
      const bytes = Uint8Array.from(binary, function (ch) { return ch.charCodeAt(0); });
      const parsed = JSON.parse(new TextDecoder().decode(bytes));
      if (!parsed || parsed.v !== 1) return DEFAULT_POLICY;
      const out = {};
      for (const k in DEFAULT_POLICY) out[k] = parsed[k] !== undefined ? parsed[k] : DEFAULT_POLICY[k];
      if (out.intercept !== 'all') out.intercept = 'tailnet';
      if (out.whenUnavailable !== 'error') out.whenUnavailable = 'network';
      if (typeof out.proxyPath !== 'string' || !/^[A-Za-z0-9_-]+\/$/.test(out.proxyPath)) out.proxyPath = null;
      return out;
    } catch {
      return DEFAULT_POLICY;
    }
  }

  const policy = readPolicy();

  /* ── owners: pages connected to the tailnet ── */

  // clientId → { port, connected }
  const owners = new Map();
  let waiters = [];
  let nextId = 1;
  const pending = new Map();

  function pickOwner() {
    let found = null;
    owners.forEach(function (o) { if (o.connected) found = o; });
    return found;
  }

  function notifyWaiters() {
    const o = pickOwner();
    if (!o) return;
    const list = waiters;
    waiters = [];
    list.forEach(function (w) { w(o); });
  }

  /** The page to ask: a connected one if there is one, else any attached page (it answers `unavailable` itself when it
   *  is not connected, so a status update still in flight cannot misroute a request). With no page attached at all (the
   *  worker was restarted and lost its ports), ask every window to re-attach and wait a little. */
  function waitForOwner(ms) {
    let o = pickOwner();
    if (!o) owners.forEach(function (x) { o = x; });
    if (o) return Promise.resolve(o);
    return new Promise(function (resolve) {
      let done = false;
      const w = function (owner) { if (!done) { done = true; resolve(owner); } };
      waiters.push(w);
      setTimeout(function () { if (!done) { done = true; waiters = waiters.filter(function (x) { return x !== w; }); resolve(null); } }, ms);
      sw.clients.matchAll({ type: 'window', includeUncontrolled: false }).then(function (list) {
        list.forEach(function (c) { c.postMessage({ type: PREFIX + 'needs-attach', v: VERSION }); });
      });
    });
  }

  function onPortMessage(clientId, entry, event) {
    const m = event.data || {};
    if (m.type === 'status') {
      entry.connected = m.connected === true;
      if (entry.connected) notifyWaiters();
      return;
    }
    const p = pending.get(m.id);
    if (!p) return;
    p.handle(m);
  }

  sw.addEventListener('install', function () { sw.skipWaiting(); });
  sw.addEventListener('activate', function (event) { event.waitUntil(sw.clients.claim()); });

  sw.addEventListener('message', function (event) {
    const m = event.data || {};
    const source = event.source;
    // Only top-level windows of this origin may serve requests: not iframes, not workers.
    if (!source || source.type !== 'window' || source.frameType === 'nested') return;
    if (event.origin && event.origin !== sw.location.origin) return;
    if (m.type === PREFIX + 'attach' && event.ports && event.ports[0]) {
      const old = owners.get(source.id);
      if (old) try { old.port.close(); } catch { /* ignore */ }
      const entry = { port: event.ports[0], connected: m.connected === true };
      owners.set(source.id, entry);
      entry.port.onmessage = function (e) { onPortMessage(source.id, entry, e); };
      entry.port.postMessage({ type: 'attached', v: VERSION, policy: policy });
      if (entry.connected) notifyWaiters();
    } else if (m.type === PREFIX + 'detach') {
      const gone = owners.get(source.id);
      if (gone) try { gone.port.close(); } catch { /* ignore */ }
      owners.delete(source.id);
    }
  });

  /* ── proxied sites (policy.proxyPath) ── */

  const PROXY_PREFIX = policy.proxyPath && sw.registration ? new URL(policy.proxyPath, sw.registration.scope).href : null;
  // Response headers that would stop a proxied page from being framed here or from running its scripts on this origin.
  const STRIPPED = {
    'content-security-policy': 1, 'content-security-policy-report-only': 1, 'x-frame-options': 1, 'set-cookie': 1,
    'cross-origin-opener-policy': 1, 'cross-origin-embedder-policy': 1, 'cross-origin-resource-policy': 1, 'strict-transport-security': 1,
  };
  const tailscaleHost = function (host) { return /(^|\.)tailscale\.(com|io)$/.test(host); };

  /** The site a proxy address loads (`<scope><proxyPath>https/example.com/a` → `https://example.com/a`), or null. */
  function proxyTarget(url) {
    if (!PROXY_PREFIX || url.indexOf(PROXY_PREFIX) !== 0) return null;
    const m = /^(https?)\/([^/?#]+)(.*)$/.exec(url.slice(PROXY_PREFIX.length));
    if (!m) return null;
    const rest = m[3] || '';
    return m[1] + '://' + m[2] + (rest.charAt(0) === '/' ? rest : '/' + rest);
  }

  /** A URL on this origin as the proxied site would have it (`/watch?v=1` → `https://www.youtube.com/watch?v=1`). */
  function siteUrl(url, origin) {
    try {
      const u = new URL(url);
      const site = proxyTarget(u.href);
      if (site) return site;
      return u.origin === sw.location.origin ? origin + u.pathname + u.search : u.href;
    } catch { return null; }
  }

  // Which clients (frames) show which site. Kept in the Cache API too: the browser stops an idle worker, and the frame lives on.
  const frames = new Map();
  const notFrames = new Set();
  const FRAME_CACHE = 'bl-ts-frames-v1';
  let hasFrameCache = false;
  const frameKey = function (id) { return new Request(sw.location.origin + '/__bl-ts-frame/' + encodeURIComponent(id)); };
  if (PROXY_PREFIX && typeof caches !== 'undefined') caches.has(FRAME_CACHE).then(function (yes) { hasFrameCache = yes; }, function () { /* no Cache API here */ });

  function rememberFrame(id, origin) {
    if (!id) return;
    frames.set(id, origin);
    notFrames.delete(id);
    if (typeof caches === 'undefined') return;
    hasFrameCache = true;
    caches.open(FRAME_CACHE).then(function (c) { return c.put(frameKey(id), new Response(origin)); }).catch(function () { /* kept in memory only */ });
  }

  function lookupFrame(id) {
    if (!id) return Promise.resolve(null);
    if (frames.has(id)) return Promise.resolve(frames.get(id));
    if (typeof caches === 'undefined') return Promise.resolve(null);
    return caches.open(FRAME_CACHE)
      .then(function (c) { return c.match(frameKey(id)); })
      .then(function (r) { return r ? r.text() : null; })
      .then(function (origin) { if (origin) frames.set(id, origin); return origin; })
      .catch(function () { return null; });
  }

  sw.addEventListener('activate', function (event) {
    // Forget frames whose windows are gone.
    if (typeof caches === 'undefined') return;
    event.waitUntil(caches.open(FRAME_CACHE).then(function (c) {
      return Promise.all([c.keys(), sw.clients.matchAll({ includeUncontrolled: true })]).then(function (got) {
        const live = {};
        got[1].forEach(function (cl) { live[cl.id] = 1; });
        return Promise.all(got[0].map(function (req) {
          const id = decodeURIComponent(req.url.split('/__bl-ts-frame/')[1] || '');
          return live[id] ? null : c.delete(req);
        }));
      });
    }).catch(function () { /* nothing to forget */ }));
  });

  /** A value as a JavaScript literal that is safe inside an inline <script> (no "</script>" can end it early). */
  const literal = function (v) { return JSON.stringify(v).replace(/</g, '\\u003c'); };

  /** An error page for a proxied frame (a document) or a plain error response (anything else). */
  function failed(proxy, status, message) {
    if (!proxy.document) return new Response(message, { status: status, headers: { 'content-type': 'text/plain; charset=utf-8', 'x-bl-tailscale': 'error' } });
    const esc = function (text) { return String(text).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
    const html = '<!doctype html><meta charset="utf-8"><title>Can\u2019t open the page</title><body style="font:15px system-ui;margin:3em;color:#555">'
      + '<h1 style="font-size:20px;color:#222">Can\u2019t open ' + esc(proxy.url) + '</h1><p>' + esc(message) + '</p>'
      + '<script>parent.postMessage({ type: "bl-tailnet-frame", url: ' + literal(proxy.url) + ', title: document.title, error: ' + literal(String(message)) + ' }, location.origin)</script>';
    return new Response(html, { status: status, headers: { 'content-type': 'text/html; charset=utf-8', 'x-bl-tailscale': 'error' } });
  }

  /** Runs first in every proxied page: the page sees its own path (not the proxy address), its links and forms stay in the
   *  proxy, and the embedding page hears where it is and what it is called. Its origin stays this one: that is the limit. */
  function frameScript(PREFIX, START) {
    const here = location.origin;
    const site = new URL(START).origin;
    const real = function (u) {
      const x = new URL(u, location.href);
      if (x.origin !== here) return x.href;
      if (x.href.indexOf(PREFIX) === 0) return null;
      return site + x.pathname + x.search + x.hash;
    };
    const proxy = function (u) { const x = new URL(u); return PREFIX + x.protocol.slice(0, -1) + '/' + x.host + x.pathname + x.search + x.hash; };
    const start = new URL(START);
    try { history.replaceState(history.state, '', start.pathname + start.search + (location.hash || start.hash)); } catch (e) { /* keep the proxy address */ }
    let last = '';
    const report = function () {
      const url = real(location.href) || START;
      const key = url + '\n' + document.title;
      if (key === last) return;
      last = key;
      try { parent.postMessage({ type: 'bl-tailnet-frame', url: url, title: document.title }, here); } catch (e) { /* no parent */ }
    };
    ['pushState', 'replaceState'].forEach(function (k) {
      const f = history[k];
      history[k] = function (...args) { const r = f.apply(this, args); report(); return r; };
    });
    addEventListener('popstate', report);
    addEventListener('hashchange', report);
    addEventListener('DOMContentLoaded', report);
    addEventListener('load', report);
    setInterval(report, 1000);
    const http = function (u) { return u && /^https?:/i.test(u); };
    addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0) return;
      const a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
      if (!a || a.hasAttribute('download')) return;
      const href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#' || /^(javascript|mailto|tel):/i.test(href)) return;
      const r = real(a.href);
      if (!http(r)) return;
      e.preventDefault();
      if (a.target === '_blank' || e.metaKey || e.ctrlKey || e.shiftKey) parent.postMessage({ type: 'bl-tailnet-open', url: r }, here);
      else if (a.target === '_top' || a.target === '_parent') parent.postMessage({ type: 'bl-tailnet-go', url: r }, here);
      else location.href = proxy(r);
    });
    addEventListener('submit', function (e) {
      const f = e.target;
      if (!f || !f.getAttribute) return;
      const r = real(f.getAttribute('action') ? f.action : location.href);
      if (http(r)) f.setAttribute('action', proxy(r));
      f.removeAttribute('target');
    }, true);
    window.open = function (u) {
      if (u) { const r = real(String(u)); if (http(r)) parent.postMessage({ type: 'bl-tailnet-open', url: r }, here); }
      return null;
    };
  }

  /** The document's bytes with the frame script as the first thing in it. */
  function withFrameScript(chunks, url) {
    let size = 0;
    chunks.forEach(function (c) { size += c.byteLength; });
    const all = new Uint8Array(size);
    let at = 0;
    chunks.forEach(function (c) { all.set(c, at); at += c.byteLength; });
    const text = new TextDecoder().decode(all);
    const tag = '<script>(' + frameScript.toString() + ')(' + literal(PROXY_PREFIX) + ',' + literal(url) + ')</script>';
    const head = /<head[^>]*>/i.exec(text);
    const doctype = /^\s*<!doctype[^>]*>/i.exec(text);
    const at2 = head ? head.index + head[0].length : doctype ? doctype[0].length : 0;
    return text.slice(0, at2) + tag + text.slice(at2);
  }

  /* ── requests ── */

  const NULL_BODY = { 101: 1, 103: 1, 204: 1, 205: 1, 304: 1 };

  function unavailable(request, why) {
    if (policy.whenUnavailable === 'error') {
      return new Response('Tailscale is not connected (' + why + ').', {
        status: 503, statusText: 'Tailscale unavailable', headers: { 'content-type': 'text/plain; charset=utf-8', 'x-bl-tailscale': 'unavailable' },
      });
    }
    return fetch(request);
  }

  function withCors(headers, request) {
    if (request.mode !== 'cors') return;
    const origin = sw.location.origin;
    if (new URL(request.url).origin === origin) return;
    const names = [];
    headers.forEach(function (_, k) { names.push(k); });
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.set('access-control-expose-headers', names.concat('x-bl-tailscale').join(', '));
    headers.append('vary', 'Origin');
  }

  function route(event, proxy) {
    const request = event.request;
    const target = proxy ? proxy.url : request.url;
    const bodyPromise = request.method === 'GET' || request.method === 'HEAD' ? Promise.resolve(null) : request.clone().arrayBuffer();
    return Promise.all([bodyPromise, waitForOwner(1500)]).then(function (got) {
      const body = got[0];
      const owner = got[1];
      // A proxied page has no public network to fall back to: its relative URLs only mean something on the site it shows.
      if (body && body.byteLength > policy.maxBodyBytes) return proxy ? failed(proxy, 413, 'The request body is too large to send through the tailnet.') : unavailable(request, 'request body too large');
      if (!owner) return proxy ? failed(proxy, 503, 'No tab is connected to Tailscale.') : unavailable(request, 'no connected page');
      const id = nextId++;
      const headers = [];
      request.headers.forEach(function (v, k) { if (k !== 'cookie') headers.push([k, v]); });
      if (proxy) {
        // The site sees itself as the origin and referrer, not this page.
        const ref = request.referrer && request.referrer !== 'about:client' ? siteUrl(request.referrer, proxy.frameOrigin) : null;
        if (ref) headers.push(['referer', ref]);
        if (request.mode === 'cors' || (request.method !== 'GET' && request.method !== 'HEAD')) headers.push(['origin', proxy.frameOrigin]);
      }
      return new Promise(function (resolve, reject) {
        let controller = null;
        let settled = false;
        const timer = setTimeout(function () {
          if (settled) return;
          settled = true;
          pending.delete(id);
          owner.port.postMessage({ type: 'cancel', id: id });
          resolve(new Response('The tailnet did not answer in time.', { status: 504, headers: { 'content-type': 'text/plain', 'x-bl-tailscale': 'timeout' } }));
        }, policy.timeoutMs);
        const cancel = function () {
          if (!pending.has(id)) return;
          pending.delete(id);
          owner.port.postMessage({ type: 'cancel', id: id });
        };
        if (request.signal) request.signal.addEventListener('abort', cancel);
        let page = null; // a proxied HTML document, gathered whole so the frame script can go in first
        pending.set(id, {
          handle: function (m) {
            if (m.type === 'head') {
              settled = true;
              clearTimeout(timer);
              const h = new Headers();
              (m.headers || []).forEach(function (pair) {
                if (proxy && STRIPPED[pair[0].toLowerCase()]) return;
                try { h.append(pair[0], pair[1]); } catch { /* forbidden */ }
              });
              h.set('x-bl-tailscale', 'routed');
              withCors(h, request);
              const status = m.status >= 200 && m.status <= 599 ? m.status : 502;
              if (proxy && proxy.document) {
                const finalUrl = typeof m.url === 'string' && /^https?:/.test(m.url) ? m.url : proxy.url;
                rememberFrame(event.resultingClientId, new URL(finalUrl).origin);
                if (/html/i.test(h.get('content-type') || '') || !h.get('content-type')) {
                  h.set('content-type', 'text/html; charset=utf-8');
                  h.delete('content-length');
                  page = { chunks: [], status: status, statusText: m.statusText || '', headers: h, url: finalUrl, resolve: resolve };
                  return;
                }
              }
              const stream = NULL_BODY[status] || request.method === 'HEAD' ? null : new ReadableStream({
                start: function (c) { controller = c; },
                cancel: cancel,
              });
              if (!stream) pending.delete(id);
              resolve(new Response(stream, { status: status, statusText: m.statusText || '', headers: h }));
            } else if (m.type === 'chunk') {
              if (page && m.data) page.chunks.push(new Uint8Array(m.data));
              else if (controller && m.data) controller.enqueue(new Uint8Array(m.data));
            } else if (m.type === 'end') {
              pending.delete(id);
              if (page) page.resolve(new Response(withFrameScript(page.chunks, page.url), { status: page.status, statusText: page.statusText, headers: page.headers }));
              else if (controller) controller.close();
            } else if (m.type === 'error') {
              pending.delete(id);
              clearTimeout(timer);
              if (page) page.resolve(failed(proxy, 502, m.message || 'Tailscale request failed'));
              else if (controller) controller.error(new TypeError(m.message || 'Tailscale request failed'));
              else if (!settled) { settled = true; resolve(proxy && proxy.document ? failed(proxy, 502, m.message || 'Tailscale request failed') : Promise.reject(new TypeError(m.message || 'Tailscale request failed'))); }
            } else if (m.type === 'passthrough' || m.type === 'unavailable') {
              pending.delete(id);
              clearTimeout(timer);
              if (!settled) { settled = true; resolve(proxy ? failed(proxy, 503, 'Tailscale is not connected.') : m.type === 'passthrough' ? fetch(request) : unavailable(request, 'disconnected')); }
            }
          },
        });
        const message = {
          type: 'request', id: id, url: target, method: request.method, headers: headers, body: body,
          // A document is fetched as GET by the frame; redirects are followed in the page so the frame learns where it ended up.
          redirect: proxy && proxy.document ? 'follow' : request.redirect, credentials: request.credentials, mode: request.mode, destination: request.destination,
          proxied: !!proxy,
        };
        owner.port.postMessage(message, body ? [body] : []);
      });
    });
  }

  sw.addEventListener('fetch', function (event) {
    const request = event.request;
    if (PROXY_PREFIX) {
      const site = proxyTarget(request.url);
      if (site) {
        // A frame opening a site through the tailnet (or a resource asked for by its proxy address).
        const isDocument = request.mode === 'navigate' || request.destination === 'iframe' || request.destination === 'document';
        event.respondWith(lookupFrame(event.clientId).then(function (origin) {
          return route(event, { url: site, frameOrigin: isDocument ? new URL(site).origin : origin || new URL(site).origin, document: isDocument });
        }));
        return;
      }
      if (request.mode !== 'navigate' && event.clientId && !notFrames.has(event.clientId)) {
        // Is this request from a proxied page? Everything it asks for goes through the tailnet; its own-origin URLs mean its site.
        const known = frames.get(event.clientId);
        const forFrame = function (origin) {
          if (!origin) {
            notFrames.add(event.clientId);
            return null;
          }
          const u = new URL(request.url);
          if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
          const url = u.origin === sw.location.origin ? origin + u.pathname + u.search : u.href;
          if (tailscaleHost(new URL(url).hostname)) return null;
          return { url: url, frameOrigin: origin, document: false };
        };
        if (known) {
          const proxy = forFrame(known);
          if (proxy) { event.respondWith(route(event, proxy)); return; }
        } else if (frames.size || hasFrameCache) {
          // Not seen since this worker started: ask the cache (it outlives the worker), else let the request through untouched.
          event.respondWith(lookupFrame(event.clientId).then(function (origin) {
            const proxy = forFrame(origin);
            if (proxy) return route(event, proxy);
            return match(request.url, request.method, policy, sw.location.origin).route ? route(event) : fetch(request);
          }));
          return;
        }
      }
    }
    if (request.mode === 'navigate') return; // a navigation is the page itself, never the tailnet's
    const m = match(request.url, request.method, policy, sw.location.origin);
    if (!m.route) return; // not ours: the browser handles it as if there were no worker
    event.respondWith(route(event));
  });

  // For the unit tests (and curious readers in devtools): the matcher and the policy this worker runs with.
  sw.__blTailscaleRouter = { version: VERSION, policy: policy, match: match };
})();
