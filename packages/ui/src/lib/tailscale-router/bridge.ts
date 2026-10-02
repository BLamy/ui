/* ══ Tailscale request router — the page's side ══
   registerTailscaleRouter({ tailscale, policy: { hosts: ['*.corp.example'] } })
   registers tailscale-sw.js (copied to your site's root), attaches this page to it over a MessagePort and serves the
   requests it hands over through the tailnet connection. With it, a plain `fetch('http://nas.tail1234.ts.net/')`, an
   `<img src>` or a library's XHR reaches the tailnet without knowing about it.

   Who can see what: the worker sees every request its policy matches (URL, headers except Cookie, body) and passes
   it to a connected top-level page of this origin. Same-origin script is inside that boundary — it can register its
   own worker or attach a port of its own — so this is no defence against XSS; it is a router, not a sandbox. */

import { encodeTailscalePolicy, matchTailscalePolicy, resolveTailscalePolicy, type ResolvedTailscalePolicy, type TailscalePolicy } from '@/lib/tailscale-policy';
import type { TailscaleRequest, TailscaleResponse } from '@/lib/tailscale';

/** What the router needs from the connection: `createTailscale()`'s controller satisfies it. */
export interface TailscaleRouteTarget {
  fetch(request: TailscaleRequest): Promise<TailscaleResponse>;
  getSnapshot(): { status: string };
  subscribe(listener: () => void): () => void;
}

/** The request as the router offers it to `shouldRoute`. */
export interface TailscaleRoutedRequest {
  url: string;
  method: string;
  headers: Array<[string, string]>;
  destination: string;
  mode: string;
}

export interface TailscaleRouterOptions {
  tailscale: TailscaleRouteTarget;
  policy?: TailscalePolicy;
  /** The worker script's URL. Default `tailscale-sw.js` next to the document's base URL (your `public/` root). */
  serviceWorkerUrl?: string;
  /** Default: the script's directory. A worker only sees pages under its scope. */
  scope?: string;
  /** A last say, in the page, for each matched request: return false to send it to the normal network instead. */
  shouldRoute?: (request: TailscaleRoutedRequest) => boolean | Promise<boolean>;
  /** Unregister the worker on `dispose()`. Default false: it stays installed, and idle, for the next visit. */
  unregisterOnDispose?: boolean;
  /** For tests: a stand-in for `navigator.serviceWorker`, and whether the page is a secure context. */
  env?: { serviceWorker?: ServiceWorkerContainer | null; isSecureContext?: boolean };
}

export type TailscaleRouterStatus = 'unsupported' | 'registering' | 'active' | 'uncontrolled' | 'error';

export interface TailscaleRouterState {
  status: TailscaleRouterStatus;
  /** Why it is unsupported or failed, in plain words. */
  detail: string | null;
  /** Requests this page has served for the worker. */
  routed: number;
  policy: ResolvedTailscalePolicy;
}

export interface TailscaleRouterHandle {
  getState(): TailscaleRouterState;
  subscribe(listener: () => void): () => void;
  /** Resolves once registered and attached (or settled as unsupported / error). */
  ready: Promise<TailscaleRouterState>;
  /** Detach (and unregister, if asked to). */
  dispose(): Promise<void>;
  /** Remove the worker from this origin. */
  unregister(): Promise<boolean>;
}

/** The worker URL for a policy: the policy travels in the `p` parameter. */
export function tailscaleServiceWorkerUrl(policy: ResolvedTailscalePolicy, base = 'tailscale-sw.js', relativeTo?: string): string {
  const u = new URL(base, relativeTo ?? (typeof document !== 'undefined' ? document.baseURI : 'http://localhost/'));
  u.searchParams.set('p', encodeTailscalePolicy(policy));
  return u.href;
}

/** Why a page cannot use the router, or null. */
export function tailscaleRouterUnsupportedReason(env: TailscaleRouterOptions['env'] = {}): string | null {
  const secure = env.isSecureContext ?? (typeof window !== 'undefined' && window.isSecureContext);
  if (!secure) return 'Service workers need HTTPS (or localhost).';
  const container = env.serviceWorker !== undefined ? env.serviceWorker : typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined;
  if (!container) return 'This browser has no service workers (or they are turned off, as in some private windows).';
  return null;
}

const NULL_BODY = new Set([101, 103, 204, 205, 304]);

interface WorkerRequest {
  type: 'request';
  id: number;
  url: string;
  method: string;
  headers: Array<[string, string]>;
  body: ArrayBuffer | null;
  redirect: RequestRedirect;
  credentials: RequestCredentials;
  mode: string;
  destination: string;
}

export function registerTailscaleRouter(options: TailscaleRouterOptions): TailscaleRouterHandle {
  const policy = resolveTailscalePolicy(options.policy);
  const listeners = new Set<() => void>();
  let state: TailscaleRouterState = { status: 'registering', detail: null, routed: 0, policy };
  const set = (patch: Partial<TailscaleRouterState>) => {
    state = { ...state, ...patch };
    listeners.forEach((l) => l());
  };
  const reason = tailscaleRouterUnsupportedReason(options.env);
  const container = options.env?.serviceWorker !== undefined ? options.env.serviceWorker : typeof navigator !== 'undefined' ? navigator.serviceWorker : null;
  let disposed = false;
  let port: MessagePort | null = null;
  let registration: ServiceWorkerRegistration | null = null;
  const inflight = new Map<number, AbortController>();
  const connected = () => options.tailscale.getSnapshot().status === 'connected';
  const origin = typeof location !== 'undefined' ? location.origin : undefined;

  const unsubscribe = options.tailscale.subscribe(() => port?.postMessage({ type: 'status', connected: connected() }));

  async function serve(p: MessagePort, m: WorkerRequest) {
    const ac = new AbortController();
    inflight.set(m.id, ac);
    try {
      // The worker matched on its copy of the policy; check again here, and give `shouldRoute` its say.
      const req: TailscaleRoutedRequest = { url: m.url, method: m.method, headers: m.headers, destination: m.destination, mode: m.mode };
      if (!matchTailscalePolicy(m.url, m.method, policy, origin).route || (options.shouldRoute && !(await options.shouldRoute(req)))) {
        p.postMessage({ type: 'passthrough', id: m.id });
        return;
      }
      if (!connected()) {
        p.postMessage({ type: 'unavailable', id: m.id });
        return;
      }
      const res = await options.tailscale.fetch({
        url: m.url, method: m.method, headers: m.headers, body: m.body ? new Uint8Array(m.body) : null, redirect: m.redirect, signal: ac.signal,
      });
      if (m.redirect === 'error' && res.status >= 300 && res.status < 400) throw new TypeError('Redirect refused (redirect: "error").');
      p.postMessage({ type: 'head', id: m.id, status: res.status, statusText: res.statusText ?? '', headers: res.headers });
      set({ routed: state.routed + 1 });
      if (NULL_BODY.has(res.status) || m.method === 'HEAD' || !res.body) {
        p.postMessage({ type: 'end', id: m.id });
        return;
      }
      if (res.body instanceof Uint8Array) {
        const copy = res.body.slice().buffer;
        p.postMessage({ type: 'chunk', id: m.id, data: copy }, [copy]);
      } else {
        const reader = res.body.getReader();
        for (;;) {
          if (ac.signal.aborted) {
            await reader.cancel();
            return;
          }
          const { done, value } = await reader.read();
          if (done) break;
          const copy = value.slice().buffer;
          p.postMessage({ type: 'chunk', id: m.id, data: copy }, [copy]);
        }
      }
      p.postMessage({ type: 'end', id: m.id });
    } catch (e) {
      p.postMessage({ type: 'error', id: m.id, message: e instanceof Error ? e.message : String(e) });
    } finally {
      inflight.delete(m.id);
    }
  }

  function attach(worker: ServiceWorker | null) {
    if (disposed || !worker) return;
    port?.close();
    const channel = new MessageChannel();
    port = channel.port1;
    const p = channel.port1;
    p.onmessage = (e: MessageEvent) => {
      const m = e.data as { type?: string; id?: number };
      if (m.type === 'request') void serve(p, m as WorkerRequest);
      else if (m.type === 'cancel' && typeof m.id === 'number') inflight.get(m.id)?.abort();
    };
    worker.postMessage({ type: 'bl-ts/attach', v: 1, connected: connected() }, [channel.port2]);
  }

  const onWorkerMessage = (e: MessageEvent) => {
    if ((e.data as { type?: string } | null)?.type === 'bl-ts/needs-attach') attach(container?.controller ?? registration?.active ?? null);
  };
  const onControllerChange = () => {
    if (container?.controller) {
      attach(container.controller);
      if (state.status === 'uncontrolled') set({ status: 'active', detail: null });
    }
  };

  const ready = (async (): Promise<TailscaleRouterState> => {
    if (reason || !container) {
      set({ status: 'unsupported', detail: reason });
      return state;
    }
    try {
      const url = tailscaleServiceWorkerUrl(policy, options.serviceWorkerUrl);
      container.addEventListener('message', onWorkerMessage);
      container.addEventListener('controllerchange', onControllerChange);
      registration = await container.register(url, { scope: options.scope, updateViaCache: 'none' });
      const worker = registration.active ?? registration.waiting ?? registration.installing;
      if (worker && worker.state !== 'activated') {
        await new Promise<void>((resolve) => {
          const done = () => { if (worker.state === 'activated' || worker.state === 'redundant') { worker.removeEventListener('statechange', done); resolve(); } };
          worker.addEventListener('statechange', done);
          done();
        });
      }
      if (disposed) return state;
      // clients.claim() in the worker's activate makes it this page's controller; a hard reload (Shift) bypasses workers.
      if (!container.controller) {
        await new Promise<void>((resolve) => {
          const t = setTimeout(resolve, 3000);
          container.addEventListener('controllerchange', () => { clearTimeout(t); resolve(); }, { once: true });
        });
      }
      if (disposed) return state;
      const target = container.controller ?? registration.active;
      attach(target);
      set(container.controller
        ? { status: 'active', detail: null }
        : { status: 'uncontrolled', detail: 'This page is not controlled by the worker (a hard reload bypasses it). Reload normally.' });
    } catch (e) {
      set({ status: 'error', detail: e instanceof Error ? e.message : String(e) });
    }
    return state;
  })();

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    ready,
    async dispose() {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      inflight.forEach((ac) => ac.abort());
      container?.removeEventListener('message', onWorkerMessage);
      container?.removeEventListener('controllerchange', onControllerChange);
      try {
        (container?.controller ?? registration?.active)?.postMessage({ type: 'bl-ts/detach' });
      } catch { /* worker gone */ }
      port?.close();
      port = null;
      if (options.unregisterOnDispose) {
        await ready;
        await registration?.unregister();
      }
    },
    async unregister() {
      await ready;
      return registration ? registration.unregister() : false;
    },
  };
}
