/* ══ The real tailnet client: Tailscale's Go code as WebAssembly ══
   Adapts `@agent-wasm/tailscale-connect` — the fork of Tailscale's `cmd/tsconnect` package that almostnode builds
   (BSD-3-Clause, Tailscale Inc.; github.com/blamy/almostnode, packages/tailscale-connect) — to `TailscaleClient`.
   The package is an optional peer dependency, imported only when `start()` runs, and its `main.wasm` is about 26 MB:
   host it yourself and pass its URL (`wasmURL`), the way almostnode does with Vite's `?url` import.

   What it relies on (from the package's pkg.d.ts and almostnode's worker; not exercised against a real tailnet here):
     createIPN({ authKey, controlURL, hostname, stateStorage, wasmURL, panicHandler }) → ipn
     ipn.run({ notifyState, notifyNetMap, notifyBrowseToURL, notifyPanicRecover })
     ipn.login() / ipn.logout()
     ipn.fetch(url | { url, method, headers, bodyBase64, redirect }) → { status, statusText, headers, bodyBase64 }
   Browsers cannot send UDP, so every packet is relayed over Tailscale's DERP servers on WebSockets; there are no direct
   connections. Bodies are buffered (base64) both ways, so nothing streams. almostnode runs the client in a dedicated
   Worker with shims around it; this adapter runs it where you call it (the main thread, unless you construct it in a worker
   yourself). Tailnet names resolve in the client (MagicDNS). Through an exit node, a public name is looked up over
   DNS-over-HTTPS and given to the client as `ipMap`, as almostnode does (see `dnsVia`). */

import type { TailscaleClient, TailscaleClientState, TailscaleNetMap, TailscaleRequest, TailscaleResponse } from '@/lib/tailscale';

/** The slice of the package's IPN this uses (structural, so this file's types do not depend on it). */
export interface TailscaleIpn {
  run(callbacks: {
    notifyState: (state: TailscaleClientState) => void;
    notifyNetMap: (netMap: string) => void;
    notifyBrowseToURL: (url: string) => void;
    notifyPanicRecover: (error: string) => void;
  }): void;
  login(): void;
  logout(): void;
  /** Applies prefs at runtime (the exit node). Not every build has it. */
  configure?(config: Record<string, unknown>): Promise<void>;
  fetch(request: string | { url: string; method?: string; headers?: Record<string, string>; bodyBase64?: string; redirect?: RequestRedirect; tlsServerName?: string }): Promise<{
    url?: string;
    status: number;
    statusText?: string;
    headers?: Record<string, string>;
    bodyBase64?: string;
    text?: () => Promise<string>;
  }>;
}

export interface TailscaleConnectModule {
  createIPN(config: {
    authKey: string;
    controlURL?: string;
    hostname?: string;
    stateStorage?: { getState(id: string): string; setState(id: string, value: string): void };
    wasmURL?: string;
    panicHandler: (error: string) => void;
    /** DNS settings; almostnode passes each in camelCase and PascalCase because the Go side reads the latter. */
    [setting: string]: unknown;
  }): Promise<TailscaleIpn>;
}

export interface TailscaleConnectOptions {
  /** Where `main.wasm` is served (for Vite: `import wasmURL from '@agent-wasm/tailscale-connect/main.wasm?url'`). */
  wasmURL: string;
  /** Loads the package. Default `import('@agent-wasm/tailscale-connect')`. */
  load?: () => Promise<TailscaleConnectModule>;
  /** Use the tailnet's DNS (MagicDNS at 100.100.100.100) so names like `nas.tail1234.ts.net` resolve inside the client. Default true.
   *  almostnode found name-based fetches failing in the WebAssembly runtime without it; this sends the settings it sends. */
  acceptDns?: boolean;
  /** A DNS-over-HTTPS (JSON) endpoint for public host names while an exit node is in use. The client cannot resolve them itself,
   *  so the name is looked up here and handed to the client as `ipMap` (the way almostnode does it). Default
   *  `https://cloudflare-dns.com/dns-query`, or `https://1.1.1.1/dns-query` with `dnsVia: 'exit-node'`. */
  dohUrl?: string;
  /** Where that lookup is sent. `page` (default, as almostnode does): the page's own network, which leaks the names you visit to the
   *  DNS server. `exit-node`: through the tailnet client, so through the exit node; it needs an IP-literal `dohUrl`. */
  dnsVia?: 'page' | 'exit-node';
  /** The `fetch` for a `page` lookup. Default `globalThis.fetch`. */
  dnsFetch?: typeof fetch;
}

/** The client keeps its prefs as hex-encoded JSON under `profile-…` keys, and a login can write `CorpDNS: false` back;
 *  almostnode rewrites it to true on the way in (its worker's stateStorage.setState), and so does this. */
export function keepCorpDns(id: string, value: string): string {
  if (!id.startsWith('profile-') || !value || value.length % 2) return value;
  try {
    const bytes = new Uint8Array(value.length / 2);
    for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(value.slice(i * 2, i * 2 + 2), 16);
    const prefs: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!prefs || typeof prefs !== 'object' || (prefs as { CorpDNS?: unknown }).CorpDNS !== false) return value;
    const out = new TextEncoder().encode(JSON.stringify({ ...prefs, CorpDNS: true }, null, '\t'));
    return Array.from(out, (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return value; // not a JSON profile: leave it alone
  }
}

/** The DNS part of createIPN's config, as almostnode sends it (tailscale-connect-worker.ts, createWorkerIpn). */
function dnsSettings(on: boolean): Record<string, unknown> {
  return {
    acceptDns: on, corpDns: on, corpDNS: on, CorpDNS: on, dns: on,
    dnsIP: on ? '100.100.100.100' : null,
    bootstrapDns: on ? ['100.100.100.100', 'fd7a:115c:a1e0::53'] : [],
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

function base64ToBytes(text: string): Uint8Array {
  const binary = atob(text);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** What to send the client (as `configure`, or inside `createIPN`) to use, or stop using, an exit node. The Go side reads the
    PascalCase names and the types document the camelCase ones; almostnode sends both, so this does. Exit-node mode needs the
    tailnet's DNS on, since there is no host resolver behind the WebAssembly client. */
export function exitNodeSettings(id: string | null): Record<string, unknown> {
  const on = id !== null;
  return { useExitNode: on, routeAll: on, RouteAll: on, exitNodeId: id, exitNodeID: id, ExitNodeID: id, ...dnsSettings(true) };
}

const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;
/** A name that needs public DNS: not an address, not a tailnet (`*.ts.net`) or MagicDNS short name, not loopback. */
export function isPublicName(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  return h.includes('.') && !IPV4.test(h) && !h.includes(':') && !h.startsWith('[') && !h.endsWith('.ts.net') && h !== 'localhost' && !h.endsWith('.localhost');
}

/** A `TailscaleClient` over `@agent-wasm/tailscale-connect`. Nothing loads until `start()`. */
export function createTailscaleConnectClient(options: TailscaleConnectOptions): TailscaleClient {
  let ipn: TailscaleIpn | null = null;
  let disposed = false;
  let exitNodeId: string | null = null;
  /** Public host name → address and when to forget it. Cleared whenever the exit node changes. */
  const addresses = new Map<string, { ip: string; until: number }>();
  /** What the client has been told: host name → address. It dials the address for the name (keeping the name for Host and TLS). */
  const ipMap: Record<string, string> = {};

  /** An A record for `host` from a DNS-over-HTTPS server: over the page's network (almostnode's way), or through the exit node. */
  async function resolvePublic(host: string): Promise<string> {
    const hit = addresses.get(host);
    if (hit && hit.until > Date.now()) return hit.ip;
    const viaExit = options.dnsVia === 'exit-node';
    const endpoint = new URL(options.dohUrl ?? (viaExit ? 'https://1.1.1.1/dns-query' : 'https://cloudflare-dns.com/dns-query'));
    endpoint.searchParams.set('name', host);
    endpoint.searchParams.set('type', 'A');
    let status: number;
    let text: string;
    if (viaExit) {
      if (!ipn) throw new Error('The Tailscale client is not running.');
      const res = await ipn.fetch({ url: endpoint.href, headers: { accept: 'application/dns-json' } });
      status = res.status;
      text = res.text ? await res.text() : new TextDecoder().decode(base64ToBytes(res.bodyBase64 ?? ''));
    } else {
      const res = await (options.dnsFetch ?? globalThis.fetch.bind(globalThis))(endpoint.href, { headers: { accept: 'application/dns-json' } });
      status = res.status;
      text = await res.text();
    }
    if (status !== 200) throw new Error(`DNS lookup for ${host} failed (HTTP ${status}).`);
    const answer = (JSON.parse(text) as { Answer?: Array<{ type?: number; data?: string; TTL?: number }> }).Answer?.find((a) => a.type === 1 && typeof a.data === 'string' && IPV4.test(a.data));
    if (!answer?.data) throw new Error(`${host} has no address to look up.`);
    addresses.set(host, { ip: answer.data, until: Date.now() + Math.min(Math.max(answer.TTL ?? 60, 30), 300) * 1000 });
    return answer.data;
  }

  /** The exit node, DNS and address map, applied together (almostnode sends the whole config each time). */
  const applyConfig = () => ipn?.configure?.({ ...exitNodeSettings(exitNodeId), ...(Object.keys(ipMap).length ? { ipMap: { ...ipMap } } : {}) });

  return {
    async start(o) {
      if (!options.wasmURL) throw new Error('createTailscaleConnectClient needs `wasmURL` (where main.wasm is served).');
      const mod = await (options.load ?? (() => import('@agent-wasm/tailscale-connect') as unknown as Promise<TailscaleConnectModule>))();
      const state = new Map(Object.entries(o.state ?? {}));
      const instance = await mod.createIPN({
        authKey: o.authKey ?? '',
        controlURL: o.controlUrl,
        hostname: o.hostname,
        wasmURL: options.wasmURL,
        stateStorage: {
          getState: (id) => state.get(id) ?? '',
          setState: (id, value) => {
            state.set(id, options.acceptDns !== false ? keepCorpDns(id, value) : value);
            o.onState(Object.fromEntries(state));
          },
        },
        panicHandler: (error) => o.onEvent({ error }),
        ...dnsSettings(options.acceptDns !== false),
      });
      if (disposed) return;
      ipn = instance;
      instance.run({
        notifyState: (s) => o.onEvent({ state: s }),
        notifyNetMap: (text) => {
          try {
            const netMap = JSON.parse(text) as TailscaleNetMap;
            // A build that never reports the choice (the Go side of the bundled one does not) must not have it cleared by every
            // net map: only a map that says something about it (even null) settles it, as the session does.
            if (netMap.selectedExitNodeId !== undefined) exitNodeId = netMap.selectedExitNodeId;
            o.onEvent({ netMap });
          } catch {
            o.onEvent({ netMap: null });
          }
        },
        notifyBrowseToURL: (url) => o.onEvent({ loginUrl: url }),
        notifyPanicRecover: (error) => o.onEvent({ error }),
      });
    },
    login() {
      ipn?.login();
    },
    logout() {
      ipn?.logout();
    },
    async setExitNode(id) {
      if (!ipn) throw new Error('The Tailscale client is not running.');
      if (!ipn.configure) throw new Error('This build of the Tailscale client cannot change its exit node.');
      exitNodeId = id;
      await applyConfig();
      addresses.clear();
    },
    async fetch(req: TailscaleRequest): Promise<TailscaleResponse> {
      if (!ipn) throw new Error('The Tailscale client is not running.');
      const method = (req.method ?? 'GET').toUpperCase();
      const url = new URL(req.url);
      // Through an exit node a public name needs an address: look it up, tell the client (`ipMap`) and fetch the name as asked —
      // the way almostnode does. If the client ignores the map, dial the address with the name kept as the Host header and the
      // TLS server name instead.
      const viaExit = exitNodeId !== null && isPublicName(url.hostname);
      const simple = !viaExit && method === 'GET' && !req.body && !req.headers?.length && (req.redirect ?? 'follow') === 'follow';
      const headers = Object.fromEntries(req.headers ?? []);
      const structured = (target: string, extra: Record<string, unknown> = {}) => ({
        url: target,
        method,
        headers,
        bodyBase64: req.body ? bytesToBase64(req.body) : undefined,
        redirect: req.redirect,
        ...extra,
      });
      let res: Awaited<ReturnType<TailscaleIpn['fetch']>>;
      if (viaExit) {
        const ip = await resolvePublic(url.hostname);
        if (ipMap[url.hostname] !== ip) {
          ipMap[url.hostname] = ip;
          await applyConfig();
        }
        try {
          res = await ipn.fetch(structured(req.url));
        } catch (primary) {
          const direct = new URL(req.url);
          direct.hostname = ip;
          const withHost = { ...headers };
          for (const name of Object.keys(withHost)) if (name.toLowerCase() === 'host') delete withHost[name];
          withHost.Host = url.host;
          try {
            res = await ipn.fetch({ ...structured(direct.href), headers: withHost, ...(url.protocol === 'https:' ? { tlsServerName: url.hostname } : {}) });
          } catch (fallback) {
            const reason = (e: unknown) => (e instanceof Error ? e.message : typeof e === 'string' ? e : (e as { message?: string } | null)?.message ?? String(e));
            throw new Error(`${url.hostname} (${ip}) could not be fetched through the exit node. Fetching the name: ${reason(primary)}. Fetching the address: ${reason(fallback)}.`);
          }
        }
      } else {
        // The minimal build only takes a URL string; the structured form needs a build that has it (almostnode's does).
        res = await ipn.fetch(simple ? req.url : structured(req.url));
      }
      const body = res.bodyBase64 !== undefined ? base64ToBytes(res.bodyBase64) : res.text ? new TextEncoder().encode(await res.text()) : null;
      return { url: viaExit ? req.url : res.url ?? req.url, status: res.status, statusText: res.statusText ?? '', headers: Object.entries(res.headers ?? {}), body };
    },
    dispose() {
      // The Go runtime has no shutdown: a disposed instance stops being used and is collected with the page.
      disposed = true;
      ipn = null;
    },
  };
}
