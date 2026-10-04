/* Loading a page through the tailnet — and nothing else.
   Every byte Safari shows is fetched here, by the page's own code, through `tailscale.fetch` (which never falls back to
   the public network: it rejects while disconnected). The document is parsed in an inert DOM, stripped of everything that
   can run or reach out (scripts, frames, plug-ins, media, meta refresh, event handlers), its stylesheets and images are
   fetched the same way and inlined as data URLs, and the result is a sealed `srcdoc`: the frame that shows it also gets a
   Content-Security-Policy that forbids any request of its own, so even a gap in the stripping cannot leak one.
   This is deliberately not a service worker: a worker cannot see navigations or frames, and an http:// subresource on an
   https page is blocked before it sees it. Fetching here has neither limit. */
import { TailscaleError, toResponse, toTailscaleRequest, type Tailscale } from '@/lib/tailscale';

export interface FetchInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string | null;
  signal?: AbortSignal;
  redirect?: RequestRedirect;
}
export type Fetcher = (url: string, init?: FetchInit) => Promise<Response>;

/** A fetcher that only ever uses the tailnet. There is no fallback: while disconnected it rejects. */
export function tailnetFetcher(tailscale: Pick<Tailscale, 'fetch'>): Fetcher {
  return async (url, init = {}) => toResponse(await tailscale.fetch(await toTailscaleRequest(url, init)));
}

export interface LoadStats {
  /** Requests sent through the tailnet for this page: the document, its redirects, stylesheets and images. */
  requests: number;
  /** Assets that could not be loaded (unreachable, refused, too large, over budget). */
  failed: number;
  bytes: number;
}

export type Page =
  | { kind: 'html'; url: string; title: string; srcDoc: string; stats: LoadStats }
  | { kind: 'image'; url: string; title: string; src: string; stats: LoadStats }
  | { kind: 'text'; url: string; title: string; text: string; contentType: string; stats: LoadStats }
  | { kind: 'file'; url: string; title: string; contentType: string; size: number; stats: LoadStats };

export type LoadErrorReason = 'invalid-url' | 'offline' | 'unreachable' | 'status' | 'too-large' | 'redirects';

export class LoadError extends Error {
  readonly reason: LoadErrorReason;
  readonly status?: number;
  constructor(reason: LoadErrorReason, message: string, status?: number) {
    super(message);
    this.name = 'LoadError';
    this.reason = reason;
    this.status = status;
  }
}

export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;
export const MAX_ASSET_BYTES = 2 * 1024 * 1024;
/** Stylesheets, images and fonts one page may pull in. Beyond it they are left out, not loaded. */
export const MAX_ASSETS = 40;
const MAX_REDIRECTS = 8;
const CONCURRENCY = 6;

/** What the sealed frame may do: draw inline styles and data: images and fonts. No scripts, no network, no frames, no forms. */
export const FRAME_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; form-action 'none'; base-uri 'none'";

/* ── addresses ── */

/** What was typed, as an http(s) URL — or null when it is not an address (it may be a search). A bare word is not one, since
    `notes` could as well be a question; give a scheme (`http://nas/`) for a MagicDNS short name. */
export function parseAddress(input: string): string | null {
  const text = input.trim();
  if (!text || /\s/.test(text)) return null;
  const explicit = /^[a-z][a-z0-9+.-]*:\/\//i.test(text);
  try {
    const url = new URL(explicit ? text : `http://${text}`);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    if (!url.hostname) return null;
    if (!explicit && !url.hostname.includes('.') && !url.hostname.startsWith('[') && !url.port && url.hostname !== 'localhost') return null;
    return url.href;
  } catch {
    return null;
  }
}

/** `notes.demo-tailnet.ts.net/inbox?x=1` — an address without its scheme, root slash or fragment, as the field shows it. */
export function displayAddress(url: string): string {
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname === '/' ? '' : u.pathname}${u.search}`;
  } catch {
    return url;
  }
}

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** An absolute http(s) URL for `ref` against `base`, or null (a `javascript:` link, `mailto:`, an empty or broken one). */
export function resolveHttp(ref: string | null | undefined, base: string): string | null {
  if (!ref) return null;
  try {
    const u = new URL(ref.trim(), base);
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

/* ── requests ── */

function asLoadError(e: unknown): Error {
  if (e instanceof LoadError || (e instanceof DOMException && e.name === 'AbortError')) return e;
  if (e instanceof TailscaleError && e.reason === 'not-connected') return new LoadError('offline', 'Tailscale is not connected.');
  // The Go client rejects with plain strings or objects as often as with Errors; the reason is worth showing either way.
  const reason = e instanceof Error ? e.message : typeof e === 'string' ? e : typeof (e as { message?: unknown } | null)?.message === 'string' ? (e as { message: string }).message : '';
  return new LoadError('unreachable', reason || 'The server could not be reached through your tailnet.');
}

interface Ctx {
  fetcher: Fetcher;
  signal?: AbortSignal;
  stats: LoadStats;
  budget: { assets: number };
  cache: Map<string, Promise<string | null>>;
  /** At most CONCURRENCY requests at once. */
  limit: <T>(task: () => Promise<T>) => Promise<T>;
}

function limiter(max: number): Ctx['limit'] {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    active--;
    queue.shift()?.();
  };
  return async (task) => {
    if (active >= max) await new Promise<void>((resolve) => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      next();
    }
  };
}

/** One request, following redirects itself (so the final address is known and every hop is a tailnet request). */
async function request(fetcher: Fetcher, start: string, init: { method?: string; body?: string | null; signal?: AbortSignal; headers?: Record<string, string> }, stats: LoadStats): Promise<{ res: Response; url: string }> {
  let url = start;
  let method = init.method ?? 'GET';
  let body = init.body ?? null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    stats.requests++;
    let res: Response;
    try {
      res = await fetcher(url, { method, body, headers: init.headers, signal: init.signal, redirect: 'manual' });
    } catch (e) {
      throw asLoadError(e);
    }
    const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
    if (!location) return { res, url };
    const next = resolveHttp(location, url);
    if (!next) throw new LoadError('invalid-url', 'The page redirected somewhere that is not a web address.');
    url = next;
    if (res.status !== 307 && res.status !== 308) {
      method = 'GET';
      body = null;
    }
  }
  throw new LoadError('redirects', 'The page redirected too many times.');
}

async function readBytes(res: Response, max: number, stats: LoadStats): Promise<ArrayBuffer> {
  const declared = Number(res.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) throw new LoadError('too-large', 'The file is too large to open here.');
  const buf = await res.arrayBuffer();
  if (buf.byteLength > max) throw new LoadError('too-large', 'The file is too large to open here.');
  stats.bytes += buf.byteLength;
  return buf;
}

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let out = '';
  for (let i = 0; i < bytes.length; i += 0x8000) out += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(out);
}

const contentType = (res: Response) => (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
const isFontType = (t: string) => /^(font\/|application\/(x-)?font|application\/vnd\.ms-fontobject|application\/octet-stream$)/.test(t);

function charsetOf(res: Response, bytes: ArrayBuffer): string {
  const header = /charset=([\w-]+)/i.exec(res.headers.get('content-type') ?? '')?.[1];
  if (header) return header;
  const head = new TextDecoder('latin1').decode(bytes.slice(0, 1024));
  return /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1] ?? 'utf-8';
}

function decode(res: Response, bytes: ArrayBuffer): string {
  try {
    return new TextDecoder(charsetOf(res, bytes)).decode(bytes);
  } catch {
    return new TextDecoder('utf-8').decode(bytes);
  }
}

/** A data: URL for an image (or, for stylesheets, a font) — or null when it could not be loaded or is not one. */
function asset(ctx: Ctx, url: string, accept: 'image' | 'css'): Promise<string | null> {
  const key = `${accept}:${url}`;
  let hit = ctx.cache.get(key);
  if (!hit) {
    hit = fetchAsset(ctx, url, accept);
    ctx.cache.set(key, hit);
  }
  return hit;
}

async function fetchAsset(ctx: Ctx, url: string, accept: 'image' | 'css'): Promise<string | null> {
  if (ctx.budget.assets <= 0) {
    ctx.stats.failed++;
    return null;
  }
  ctx.budget.assets--;
  return ctx.limit(async () => {
    try {
      const { res } = await request(ctx.fetcher, url, { signal: ctx.signal }, ctx.stats);
      const type = contentType(res);
      if (!res.ok || !(type.startsWith('image/') || (accept === 'css' && isFontType(type)))) {
        ctx.stats.failed++;
        return null;
      }
      return `data:${type};base64,${toBase64(await readBytes(res, MAX_ASSET_BYTES, ctx.stats))}`;
    } catch (e) {
      if (ctx.signal?.aborted) throw e;
      ctx.stats.failed++;
      return null;
    }
  });
}

async function fetchText(ctx: Ctx, url: string): Promise<string | null> {
  if (ctx.budget.assets <= 0) {
    ctx.stats.failed++;
    return null;
  }
  ctx.budget.assets--;
  return ctx.limit(async () => {
    try {
      const { res } = await request(ctx.fetcher, url, { signal: ctx.signal }, ctx.stats);
      if (!res.ok) {
        ctx.stats.failed++;
        return null;
      }
      return decode(res, await readBytes(res, MAX_ASSET_BYTES, ctx.stats));
    } catch (e) {
      if (ctx.signal?.aborted) throw e;
      ctx.stats.failed++;
      return null;
    }
  });
}

/* ── CSS ── */

const CSS_IMPORT = /@import\s+(?:url\(\s*(['"]?)([^'")]+)\1\s*\)|(['"])([^'"]+)\3)[^;]*;/gi;
const CSS_URL = /url\(\s*(['"]?)([^'")]+?)\1\s*\)/gi;
const EMPTY_URL = 'url("data:,")';

async function replaceAsync(text: string, pattern: RegExp, replace: (match: RegExpExecArray) => Promise<string>): Promise<string> {
  const matches = [...text.matchAll(pattern)];
  const parts = await Promise.all(matches.map((m) => replace(m as RegExpExecArray)));
  let out = '';
  let last = 0;
  matches.forEach((m, i) => {
    out += text.slice(last, m.index) + parts[i];
    last = (m.index ?? 0) + m[0].length;
  });
  return out + text.slice(last);
}

/** A stylesheet with its @imports inlined (three deep) and its url()s as data: URLs; ones that cannot load become empty. */
async function inlineCss(css: string, base: string, ctx: Ctx, depth = 0): Promise<string> {
  const imported = await replaceAsync(css, CSS_IMPORT, async (m) => {
    const target = resolveHttp(m[2] ?? m[4], base);
    if (!target || depth >= 3) return '';
    const text = await fetchText(ctx, target);
    return text == null ? '' : inlineCss(text, target, ctx, depth + 1);
  });
  return replaceAsync(imported, CSS_URL, async (m) => {
    const ref = m[2].trim();
    if (ref.startsWith('data:') || ref.startsWith('#')) return m[0];
    const target = resolveHttp(ref, base);
    const data = target ? await asset(ctx, target, 'css') : null;
    return data ? `url("${data}")` : EMPTY_URL;
  });
}

/* ── HTML ── */

const REMOVE = [
  'script', 'iframe', 'frame', 'frameset', 'object', 'embed', 'applet', 'base', 'video', 'audio', 'source', 'track',
  'meta[http-equiv]', 'link:not([rel~="stylesheet" i])', 'template',
].join(',');

const firstCandidate = (srcset: string | null) => srcset?.split(',')[0]?.trim().split(/\s+/)[0] ?? null;

/** The sealed document for `html` fetched from `url`. Fetches its stylesheets and images through `ctx` as it goes. */
async function sealDocument(html: string, url: string, ctx: Ctx): Promise<{ srcDoc: string; title: string }> {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const baseHref = doc.querySelector('base[href]')?.getAttribute('href');
  const base = (baseHref && resolveHttp(baseHref, url)) || url;

  doc.querySelectorAll(REMOVE).forEach((el) => el.remove());
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) if (/^on/i.test(attr.name) || attr.name === 'srcdoc' || attr.name === 'ping' || attr.name === 'background') el.removeAttribute(attr.name);
  });

  doc.querySelectorAll('a[href], area[href]').forEach((a) => {
    const abs = resolveHttp(a.getAttribute('href'), base);
    if (abs) a.setAttribute('href', abs);
    else a.removeAttribute('href');
    a.removeAttribute('target');
    a.removeAttribute('download');
  });
  doc.querySelectorAll('form').forEach((form) => {
    form.setAttribute('action', resolveHttp(form.getAttribute('action') || url, base) ?? url);
    form.removeAttribute('target');
  });
  doc.querySelectorAll('input[type="image"]').forEach((el) => el.removeAttribute('src'));

  const tasks: Array<Promise<void>> = [];

  doc.querySelectorAll('link[rel~="stylesheet" i]').forEach((link) => {
    tasks.push((async () => {
      const href = resolveHttp(link.getAttribute('href'), base);
      const css = href ? await fetchText(ctx, href) : null;
      if (css == null || !href) {
        link.remove();
        return;
      }
      const style = doc.createElement('style');
      style.textContent = await inlineCss(css, href, ctx);
      const media = link.getAttribute('media');
      if (media) style.setAttribute('media', media);
      link.replaceWith(style);
    })());
  });

  doc.querySelectorAll('style').forEach((style) => {
    tasks.push((async () => { style.textContent = await inlineCss(style.textContent ?? '', base, ctx); })());
  });
  doc.querySelectorAll('[style]').forEach((el) => {
    tasks.push((async () => { el.setAttribute('style', await inlineCss(el.getAttribute('style') ?? '', base, ctx)); })());
  });

  doc.querySelectorAll('img').forEach((img) => {
    const target = resolveHttp(img.getAttribute('src') || firstCandidate(img.getAttribute('srcset')), base);
    for (const name of ['srcset', 'sizes', 'loading', 'crossorigin']) img.removeAttribute(name);
    if (!target) {
      img.removeAttribute('src');
      return;
    }
    tasks.push(asset(ctx, target, 'image').then((data) => {
      if (data) img.setAttribute('src', data);
      else img.removeAttribute('src');
    }));
  });

  await Promise.all(tasks);

  const csp = doc.createElement('meta');
  csp.setAttribute('http-equiv', 'Content-Security-Policy');
  csp.setAttribute('content', FRAME_CSP);
  doc.head.prepend(csp);

  const title = doc.title.replace(/\s+/g, ' ').trim();
  return { srcDoc: `<!doctype html>${doc.documentElement.outerHTML}`, title };
}

/* ── pages ── */

export interface LoadOptions {
  method?: 'GET' | 'POST';
  /** An application/x-www-form-urlencoded body for POST. */
  body?: string;
  signal?: AbortSignal;
}

const looksLikeHtml = (bytes: ArrayBuffer) => /<(!doctype|html|head|body|title|h1|p|div|a)\b/i.test(new TextDecoder('latin1').decode(bytes.slice(0, 512)));
const isTextType = (t: string) => t.startsWith('text/') || /json|xml|javascript|yaml|csv/.test(t);

/** Fetch `address` through the tailnet and make it a page. Rejects with a LoadError (or the AbortError when cancelled). */
export async function loadPage(address: string, fetcher: Fetcher, options: LoadOptions = {}): Promise<Page> {
  const stats: LoadStats = { requests: 0, failed: 0, bytes: 0 };
  const start = resolveHttp(address, address);
  if (!start) throw new LoadError('invalid-url', 'That is not a web address.');
  const { res, url } = await request(fetcher, start, {
    method: options.method,
    body: options.body,
    signal: options.signal,
    headers: options.method === 'POST' ? { 'content-type': 'application/x-www-form-urlencoded' } : undefined,
  }, stats);
  if (!res.ok) throw new LoadError('status', res.statusText || `The server answered ${res.status}.`, res.status);

  const type = contentType(res);
  const host = hostOf(url);
  const bytes = await readBytes(res, MAX_DOCUMENT_BYTES, stats);

  if (type === 'text/html' || type === 'application/xhtml+xml' || (!type && looksLikeHtml(bytes))) {
    const ctx: Ctx = { fetcher, signal: options.signal, stats, budget: { assets: MAX_ASSETS }, cache: new Map(), limit: limiter(CONCURRENCY) };
    const { srcDoc, title } = await sealDocument(decode(res, bytes), url, ctx);
    return { kind: 'html', url, title: title || host, srcDoc, stats };
  }
  if (type.startsWith('image/')) return { kind: 'image', url, title: url.split('/').pop() || host, src: `data:${type};base64,${toBase64(bytes)}`, stats };
  if (isTextType(type)) return { kind: 'text', url, title: url.split('/').pop() || host, text: decode(res, bytes), contentType: type, stats };
  return { kind: 'file', url, title: url.split('/').pop() || host, contentType: type || 'unknown type', size: bytes.byteLength, stats };
}

/** A sentence for an error page, and what to try. */
export function describeError(e: unknown): { title: string; detail: string } {
  if (e instanceof LoadError) {
    switch (e.reason) {
      case 'invalid-url': return { title: "Safari can't open the page", detail: 'That is not a web address.' };
      case 'offline': return { title: 'Not connected to Tailscale', detail: 'Sign in to Tailscale to load pages. Nothing is requested outside your tailnet.' };
      case 'status': return { title: e.status === 404 ? 'Page not found' : `The server answered ${e.status}`, detail: e.status === 404 ? 'The server has no page at this address.' : e.message };
      case 'too-large': return { title: 'The page is too large', detail: e.message };
      case 'redirects': return { title: "Safari can't open the page", detail: e.message };
      default: return { title: "Safari can't find the server", detail: `${e.message} Only devices and services on your tailnet can be reached.` };
    }
  }
  return { title: "Safari can't open the page", detail: e instanceof Error ? e.message : 'Something went wrong.' };
}
