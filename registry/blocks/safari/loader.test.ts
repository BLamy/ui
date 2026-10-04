// @vitest-environment happy-dom
// @vitest-environment-options {"settings":{"disableCSSFileLoading":true,"disableJavaScriptFileLoading":true,"disableIframePageLoading":true}}
import { describe, expect, it } from 'vitest';
import { createTailscale } from '@/lib/tailscale';
import { LoadError, describeError, displayAddress, loadPage, parseAddress, resolveHttp, tailnetFetcher, FRAME_CSP, type Fetcher } from './loader';
import { EXIT_NODE_ID, HOME, NOTES, PUBLIC_SITE, STATUS, WIKI, createDemoTailnet } from './data';

async function until(done: () => boolean, ms = 3000) {
  const end = Date.now() + ms;
  while (!done()) {
    if (Date.now() > end) throw new Error('timed out waiting for the tailnet connection');
    await new Promise((r) => setTimeout(r, 10));
  }
}

/** The real path: a controller on the simulated tailnet, signed in with a key (no popup, no timers to wait out). */
async function connected() {
  const demo = createDemoTailnet();
  const t = createTailscale({ ...demo.options, auth: { mode: 'auth-key', authKey: 'k' } });
  const off = t.activate();
  await t.signIn();
  await until(() => t.getSnapshot().status === 'connected');
  return { t, demo, off, fetcher: tailnetFetcher(t) };
}

/** A fetcher over canned responses, to count what a page asks for. */
function canned(routes: Record<string, () => Response>, seen: string[] = []): Fetcher {
  return async (url) => {
    seen.push(url);
    const make = routes[url];
    if (!make) return new Response('missing', { status: 404 });
    return make();
  };
}
const html = (body: string) => () => new Response(body, { headers: { 'content-type': 'text/html' } });

describe('addresses', () => {
  it('reads what was typed as an http(s) address, and leaves everything else to search', () => {
    expect(parseAddress('notes.demo-tailnet.ts.net')).toBe('http://notes.demo-tailnet.ts.net/');
    expect(parseAddress(' https://nas.tail1234.ts.net:8443/x?y=1 ')).toBe('https://nas.tail1234.ts.net:8443/x?y=1');
    expect(parseAddress('100.101.102.103')).toBe('http://100.101.102.103/');
    expect(parseAddress('localhost:3000')).toBe('http://localhost:3000/');
    expect(parseAddress('http://nas/')).toBe('http://nas/');
    expect(parseAddress('notes')).toBeNull(); // a bare word is a search, not a short name
    expect(parseAddress('how do I reset a router')).toBeNull();
    expect(parseAddress('javascript:alert(1)')).toBeNull();
    expect(parseAddress('file:///etc/passwd')).toBeNull();
    expect(parseAddress('')).toBeNull();
  });

  it('shows an address without its scheme or root slash, and resolves links only to http(s)', () => {
    expect(displayAddress('http://notes.demo-tailnet.ts.net/')).toBe('notes.demo-tailnet.ts.net');
    expect(displayAddress('http://a.b/c/d?e=1#f')).toBe('a.b/c/d?e=1');
    expect(resolveHttp('/x', 'http://a.b/c/d')).toBe('http://a.b/x');
    expect(resolveHttp('javascript:alert(1)', 'http://a.b/')).toBeNull();
    expect(resolveHttp('mailto:me@a.b', 'http://a.b/')).toBeNull();
    expect(resolveHttp('data:text/html,hi', 'http://a.b/')).toBeNull();
    expect(resolveHttp(null, 'http://a.b/')).toBeNull();
  });
});

describe('a page through the tailnet', () => {
  it('loads the home page with its stylesheet and images fetched through the tailnet and inlined', async () => {
    const { t, demo, off, fetcher } = await connected();
    const page = await loadPage(`http://${HOME}/`, fetcher);
    expect(page.kind).toBe('html');
    if (page.kind !== 'html') return;
    expect(page.title).toBe('Home');
    // Every request the fake tailnet answered is a tailnet host: the tracker's host never got one that was answered.
    const hosts = demo.fake.requests.map((r) => new URL(r.url).hostname);
    expect(hosts).toContain(HOME);
    expect(page.stats.requests).toBeGreaterThanOrEqual(4); // the document, style.css, logo.svg, dots.svg (and the tracker, refused)
    expect(page.srcDoc).toContain('<style>');
    expect(page.srcDoc).toContain('data:image/svg+xml;base64,'); // logo.svg and dots.svg are inline now
    expect(page.srcDoc).not.toContain('href="/style.css"');
    expect(page.srcDoc).not.toMatch(/src="\/logo\.svg"/);
    off();
    await t.dispose();
  });

  it('strips scripts, frames, plug-ins, media, refresh and event handlers', async () => {
    const seen: string[] = [];
    const fetcher = canned({
      'http://x.test/': html(`<!doctype html><html><head><title>T</title><meta http-equiv="refresh" content="0;url=http://evil.test/"><base href="http://x.test/sub/"><script>steal()</script><link rel="icon" href="/i.png"><link rel="preload" href="/p"></head>
<body onload="steal()"><script src="/s.js"></script><iframe src="http://evil.test/f"></iframe><object data="/o"></object><embed src="/e"><video src="/v.mp4"></video><audio src="/a.mp3"></audio>
<a href="javascript:steal()" onclick="steal()">js</a><a href="/ok" target="_blank" download>ok</a><p>kept</p></body></html>`),
    }, seen);
    const page = await loadPage('http://x.test/', fetcher);
    if (page.kind !== 'html') throw new Error('expected html');
    expect(page.srcDoc).toContain('kept');
    for (const bad of ['<script', '<iframe', '<object', '<embed', '<video', '<audio', 'refresh', 'evil.test', 'onload', 'onclick', 'steal', '<base', 'rel="icon"', 'rel="preload"', 'target=', 'download']) {
      expect(page.srcDoc, bad).not.toContain(bad);
    }
    expect(page.srcDoc).toContain('href="http://x.test/ok"'); // links become absolute (a path-absolute one ignores the base's path); javascript: ones lose their href
    // Nothing but the document was requested: the script, frame, embed, media and preload were never fetched.
    expect(seen).toEqual(['http://x.test/']);
  });

  it('puts the sealing Content-Security-Policy first in the head', async () => {
    const page = await loadPage('http://x.test/', canned({ 'http://x.test/': html('<html><head><title>a</title></head><body>b</body></html>') }));
    if (page.kind !== 'html') throw new Error('expected html');
    const head = page.srcDoc.slice(page.srcDoc.indexOf('<head>'));
    expect(head.indexOf('Content-Security-Policy')).toBeLessThan(head.indexOf('<title>'));
    expect(page.srcDoc).toContain(FRAME_CSP.replace(/'/g, "'"));
    expect(FRAME_CSP).toMatch(/default-src 'none'/);
    expect(FRAME_CSP).not.toMatch(/script-src|connect-src|frame-src|'self'/);
  });

  it('inlines @import and url() in stylesheets, and empties what cannot load', async () => {
    const seen: string[] = [];
    const fetcher = canned({
      'http://x.test/': html('<html><head><link rel="stylesheet" href="/a.css"></head><body style="background:url(/bg.png)">x</body></html>'),
      'http://x.test/a.css': () => new Response('@import url("/b.css");\n.h{background:url(/bg.png)}.g{background:url(http://tracker.test/t.gif)}', { headers: { 'content-type': 'text/css' } }),
      'http://x.test/b.css': () => new Response('.b{color:red;background:url("/font.woff2")}', { headers: { 'content-type': 'text/css' } }),
      'http://x.test/bg.png': () => new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }),
      'http://x.test/font.woff2': () => new Response(new Uint8Array([4, 5]), { headers: { 'content-type': 'font/woff2' } }),
    }, seen);
    const page = await loadPage('http://x.test/', fetcher);
    if (page.kind !== 'html') throw new Error('expected html');
    expect(page.srcDoc).toContain('.b{color:red');
    expect(page.srcDoc).toContain('data:image/png;base64,AQID');
    expect(page.srcDoc).toContain('data:font/woff2;base64,BAU=');
    expect(page.srcDoc).toContain('url("data:,")'); // the tracker (404 from the canned tailnet) became empty
    expect(page.srcDoc).not.toMatch(/url\(\s*['"]?\/(?!\/)/); // no url() left pointing at a path
    expect(page.srcDoc).not.toContain('@import');
    expect(page.stats.failed).toBeGreaterThanOrEqual(1);
    // bg.png was asked for once though it is used twice.
    expect(seen.filter((u) => u.endsWith('/bg.png'))).toHaveLength(1);
  });

  it('refuses a non-image as an img and a non-font as a font', async () => {
    const fetcher = canned({
      'http://x.test/': html('<html><body><img src="/a" alt=""><img src="/b" alt=""></body></html>'),
      'http://x.test/a': () => new Response('<html>not an image</html>', { headers: { 'content-type': 'text/html' } }),
      'http://x.test/b': () => new Response('GIF', { headers: { 'content-type': 'image/gif' } }),
    });
    const page = await loadPage('http://x.test/', fetcher);
    if (page.kind !== 'html') throw new Error('expected html');
    expect(page.srcDoc).toContain('data:image/gif;base64,R0lG');
    expect(page.srcDoc).not.toContain('not an image');
    expect(page.stats.failed).toBe(1);
  });

  it('stops pulling in assets after the budget', async () => {
    const imgs = Array.from({ length: 60 }, (_, i) => `<img src="/i${i}.png" alt="">`).join('');
    const seen: string[] = [];
    const routes: Record<string, () => Response> = { 'http://x.test/': html(`<html><body>${imgs}</body></html>`) };
    for (let i = 0; i < 60; i++) routes[`http://x.test/i${i}.png`] = () => new Response('x', { headers: { 'content-type': 'image/png' } });
    const page = await loadPage('http://x.test/', canned(routes, seen));
    if (page.kind !== 'html') throw new Error('expected html');
    expect(seen.length).toBe(1 + 40);
    expect(page.stats.failed).toBe(20);
  });
});

describe('redirects, forms and other kinds of file', () => {
  it('follows a redirect itself, so the page reports where it ended up', async () => {
    const { t, off, fetcher } = await connected();
    const page = await loadPage(`http://${HOME}/old`, fetcher);
    expect(page.url).toBe(`http://${WIKI}/`);
    expect(page.title).toBe('Wiki');
    expect(page.stats.requests).toBeGreaterThan(2);
    off();
    await t.dispose();
  });

  it('gives up on a redirect loop', async () => {
    const loop: Fetcher = async (url) => new Response(null, { status: 302, headers: { location: url } });
    await expect(loadPage('http://x.test/', loop)).rejects.toMatchObject({ reason: 'redirects' });
  });

  it('refuses a redirect to something that is not http(s)', async () => {
    const f: Fetcher = async () => new Response(null, { status: 302, headers: { location: 'file:///etc/passwd' } });
    await expect(loadPage('http://x.test/', f)).rejects.toMatchObject({ reason: 'invalid-url' });
  });

  it('sends a form with POST and a urlencoded body through the tailnet', async () => {
    const { t, demo, off, fetcher } = await connected();
    const page = await loadPage(`http://${NOTES}/new`, fetcher, { method: 'POST', body: 'title=Water+the+plants' });
    expect(page.kind === 'html' && page.title).toBe('Note saved');
    expect(page.kind === 'html' && page.srcDoc).toContain('Water the plants');
    const sent = demo.fake.requests.find((r) => new URL(r.url).pathname === '/new');
    expect(sent?.method).toBe('POST');
    off();
    await t.dispose();
  });

  it('shows JSON as text, an image as an image, and anything else as a file', async () => {
    const { t, off, fetcher } = await connected();
    const json = await loadPage(`http://${STATUS}/api/status.json`, fetcher);
    expect(json.kind).toBe('text');
    expect(json.kind === 'text' && JSON.parse(json.text).ok).toBe(true);
    const image = await loadPage(`http://${STATUS}/photo.svg`, fetcher);
    expect(image.kind === 'image' && image.src.startsWith('data:image/svg+xml;base64,')).toBe(true);
    const file = await loadPage(`http://${STATUS}/backup.bin`, fetcher);
    expect(file).toMatchObject({ kind: 'file', size: 2048, contentType: 'application/octet-stream' });
    off();
    await t.dispose();
  });

  it('rejects a document over the size limit', async () => {
    const big: Fetcher = async () => new Response('x'.repeat(3 * 1024 * 1024 + 1), { headers: { 'content-type': 'text/html' } });
    await expect(loadPage('http://x.test/', big)).rejects.toMatchObject({ reason: 'too-large' });
  });
});

describe('failures', () => {
  it('says "offline" while Tailscale is not connected, and never reaches the public network', async () => {
    const demo = createDemoTailnet();
    const t = createTailscale(demo.options); // never signed in
    let globalFetched = false;
    const original = globalThis.fetch;
    globalThis.fetch = (() => { globalFetched = true; return Promise.reject(new Error('the public network was used')); }) as typeof fetch;
    try {
      const error = await loadPage(`http://${HOME}/`, tailnetFetcher(t)).catch((e) => e);
      expect(error).toBeInstanceOf(LoadError);
      expect(error.reason).toBe('offline');
      expect(globalFetched).toBe(false);
      expect(describeError(error).title).toBe('Not connected to Tailscale');
    } finally {
      globalThis.fetch = original;
    }
  });

  it('answers a host that is not on the tailnet (and no exit node) with an error from the tailnet, not by going to the public internet', async () => {
    const { t, off, fetcher } = await connected();
    const original = globalThis.fetch;
    let globalFetched = false;
    globalThis.fetch = (() => { globalFetched = true; return Promise.reject(new Error('public')); }) as typeof fetch;
    try {
      const error = await loadPage('http://example.com/', fetcher).catch((e) => e);
      expect(error).toBeInstanceOf(LoadError);
      expect(error.reason).toBe('status');
      expect(error.status).toBe(502);
      expect(globalFetched).toBe(false);
    } finally {
      globalThis.fetch = original;
      off();
      await t.dispose();
    }
  });

  it('reaches the public internet only through an exit node, and only while it is chosen', async () => {
    const { t, off, fetcher } = await connected();
    const original = globalThis.fetch;
    let globalFetched = false;
    globalThis.fetch = (() => { globalFetched = true; return Promise.reject(new Error('public')); }) as typeof fetch;
    try {
      // The tailnet offers an exit node, but none is chosen: the public site fails.
      await until(() => t.getSnapshot().peers.some((p) => p.exitNode));
      expect(t.getSnapshot().exitNodeId).toBeNull();
      await expect(loadPage(`http://${PUBLIC_SITE}/`, fetcher)).rejects.toMatchObject({ reason: 'status', status: 502 });

      await t.setExitNode(EXIT_NODE_ID);
      const page = await loadPage(`http://${PUBLIC_SITE}/`, fetcher);
      expect(page.kind === 'html' && page.title).toBe('Example Domain');
      const more = await loadPage(`http://${PUBLIC_SITE}/more`, fetcher);
      expect(more.kind === 'html' && more.title).toBe('More information');
      // Tailnet sites still work with an exit node on.
      expect((await loadPage(`http://${HOME}/`, fetcher)).kind).toBe('html');

      await t.setExitNode(null);
      await expect(loadPage(`http://${PUBLIC_SITE}/`, fetcher)).rejects.toMatchObject({ status: 502 });
      expect(globalFetched).toBe(false); // none of it went to the public network
    } finally {
      globalThis.fetch = original;
      off();
      await t.dispose();
    }
  });

  it('turns a 404 into a "Page not found" error', async () => {
    const { t, off, fetcher } = await connected();
    const error = await loadPage(`http://${HOME}/nothing-here`, fetcher).catch((e) => e);
    expect(error).toMatchObject({ reason: 'status', status: 404 });
    expect(describeError(error).title).toBe('Page not found');
    off();
    await t.dispose();
  });

  it('can be cancelled', async () => {
    const ctrl = new AbortController();
    const slow: Fetcher = (_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError'))));
    const pending = loadPage('http://x.test/', slow, { signal: ctrl.signal });
    ctrl.abort();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('rejects an address that is not http(s)', async () => {
    await expect(loadPage('file:///etc/passwd', canned({}))).rejects.toMatchObject({ reason: 'invalid-url' });
  });
});
