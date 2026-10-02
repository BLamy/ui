/* ══ A fake tailnet client — for tests, stories and demos ══
   Implements `TailscaleClient` in memory: sign-in hands out a login URL and "approves" it after a delay (or when you
   call `approve()`), an auth key signs in directly, the node's state map is written like the real client writes it, and
   requests are answered by handlers you register per host. No network, no WebAssembly, no account.

   const fake = createFakeTailscaleClient({
     routes: { 'nas.example.ts.net': (req) => new Response('hello from the nas') },
   })
   createTailscale({ client: fake.client }) */

import type { TailscaleClient, TailscaleClientEvent, TailscaleClientStartOptions, TailscaleRequest, TailscaleResponse } from '@/lib/tailscale';

export type FakeTailnetHandler = (request: Request, info: { host: string }) => Response | Promise<Response>;

export interface FakeTailscaleOptions {
  /** Handlers by host (lower case, no port). Anything else gets a 502, as an unreachable peer would. */
  routes?: Record<string, FakeTailnetHandler>;
  /** Approve an interactive sign-in this long after the login URL is shown (ms). `false`: wait for `approve()`. Default 600. */
  approveAfterMs?: number | false;
  /** Startup time (ms) before the client reports a state. Default 150. */
  startMs?: number;
  /** Auth keys accepted; others are refused (the client stays at NeedsLogin). Default: any non-empty key. */
  acceptKeys?: string[];
  /** The tailnet's MagicDNS suffix. Default `example-tailnet.ts.net`. */
  tailnet?: string;
  /** The login URL the fake hands out. Default `https://login.tailscale.example/a/<random>`. */
  loginUrl?: string;
  /** Make `start()` fail with this message (to show the error state). */
  failStart?: string;
}

export interface FakeTailscale {
  client: TailscaleClient;
  /** Finish an interactive sign-in now. */
  approve(): void;
  /** Make the client crash with `message` (as a WebAssembly panic would). */
  crash(message?: string): void;
  /** Requests the fake has answered, newest last. */
  readonly requests: TailscaleRequest[];
  /** Times `start` was called — a lazily loaded client starts once. */
  readonly starts: number;
}

export function createFakeTailscaleClient(options: FakeTailscaleOptions = {}): FakeTailscale {
  const tailnet = options.tailnet ?? 'example-tailnet.ts.net';
  const requests: TailscaleRequest[] = [];
  let starts = 0;
  let current: TailscaleClientStartOptions | null = null;
  let running = false;
  let timers: Array<ReturnType<typeof setTimeout>> = [];
  const later = (ms: number, fn: () => void) => { timers.push(setTimeout(fn, ms)); };
  const emit = (e: TailscaleClientEvent) => current?.onEvent(e);

  const netMap = (hostname: string) => ({
    self: { name: `${hostname}.${tailnet}.`, addresses: ['100.100.7.42', 'fd7a:115c:a1e0::7:42'] },
    peers: Object.keys(options.routes ?? {}).map((host, i) => ({ name: `${host}.`, addresses: [`100.100.8.${i + 1}`], online: true })),
  });

  function goRunning() {
    const c = current;
    if (!c) return;
    running = true;
    c.onState({ ...(c.state ?? {}), _machinekey: 'fake-machine-key', _profile: JSON.stringify({ hostname: c.hostname }) });
    emit({ state: 'Starting' });
    later(120, () => {
      emit({ loginUrl: null, netMap: netMap(c.hostname), state: 'Running' });
    });
  }

  const client: TailscaleClient = {
    async start(o) {
      starts++;
      if (options.failStart) throw new Error(options.failStart);
      current = o;
      await new Promise((r) => setTimeout(r, options.startMs ?? 150));
      if (o.state && Object.keys(o.state).length) goRunning();
      else if (o.authKey) {
        const ok = options.acceptKeys ? options.acceptKeys.includes(o.authKey) : true;
        if (ok) goRunning();
        else emit({ state: 'NeedsLogin' });
      } else emit({ state: 'NeedsLogin' });
    },
    login() {
      const id = Math.random().toString(36).slice(2, 10);
      emit({ loginUrl: options.loginUrl ?? `https://login.tailscale.example/a/${id}` });
      if (options.approveAfterMs !== false) later(options.approveAfterMs ?? 600, goRunning);
    },
    logout() {
      running = false;
      emit({ state: 'NeedsLogin', netMap: null });
    },
    async fetch(req) {
      if (!running) throw new Error('fake tailnet: not running');
      requests.push(req);
      const url = new URL(req.url);
      const handler = options.routes?.[url.hostname.toLowerCase()];
      const init: RequestInit = { method: req.method ?? 'GET', headers: req.headers, body: req.body ? req.body.slice() : undefined };
      const res = handler
        ? await handler(new Request(req.url, init), { host: url.hostname })
        : new Response(`fake tailnet: no peer answers at ${url.hostname}`, { status: 502, headers: { 'content-type': 'text/plain' } });
      const headers: Array<[string, string]> = [];
      res.headers.forEach((v, k) => headers.push([k, v]));
      const out: TailscaleResponse = { url: req.url, status: res.status, statusText: res.statusText, headers, body: res.body };
      return out;
    },
    dispose() {
      timers.forEach(clearTimeout);
      timers = [];
      current = null;
      running = false;
    },
  };

  return {
    client,
    approve: goRunning,
    crash: (message = 'fake panic') => { running = false; emit({ error: message }); },
    requests,
    get starts() { return starts; },
  };
}
