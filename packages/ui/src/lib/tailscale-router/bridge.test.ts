/* eslint-disable @typescript-eslint/no-non-null-assertion -- test code: fixtures are known to exist */
import { afterEach, describe, expect, it } from 'vitest';
import { createTailscale, type Tailscale } from '@/lib/tailscale';
import { createFakeTailscaleClient } from '@/lib/tailscale-fake';
import { encodeTailscalePolicy, resolveTailscalePolicy, tailscaleProxyTarget, tailscaleProxyUrl, type TailscalePolicy } from '@/lib/tailscale-policy';
import { registerTailscaleRouter, tailscaleRouterUnsupportedReason, tailscaleServiceWorkerUrl, type TailscaleRouterOptions } from '@/lib/tailscale-router/bridge';
import { fakeServiceWorkerContainer, fakeWindowClient, loadServiceWorker } from '../../../test/fake-service-worker';

const ORIGIN = 'https://app.example';
const SW_URL = `${ORIGIN}/tailscale-sw.js`;

const until = async (check: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
};

const routes = {
  'nas.example-tailnet.ts.net': async (req: Request) =>
    new Response(JSON.stringify({ method: req.method, path: new URL(req.url).pathname, body: await req.text(), auth: req.headers.get('authorization'), cookie: req.headers.get('cookie') }), {
      headers: { 'content-type': 'application/json' },
    }),
  'stream.example-tailnet.ts.net': () => {
    let n = 0;
    return new Response(new ReadableStream<Uint8Array>({
      async pull(c) {
        await new Promise((r) => setTimeout(r, 5));
        if (n++ < 3) c.enqueue(new TextEncoder().encode(`chunk${n};`));
        else c.close();
      },
    }));
  },
  'empty.example-tailnet.ts.net': () => new Response(null, { status: 204 }),
  'site.example': (req: Request) => {
    const u = new URL(req.url);
    if (u.pathname === '/page') {
      return new Response('<!doctype html><html><head><title>Site</title></head><body><a href="/next">next</a></body></html>', {
        headers: { 'content-type': 'text/html', 'content-security-policy': "script-src 'none'", 'x-frame-options': 'DENY', 'x-site': '1' },
      });
    }
    return new Response(JSON.stringify({ path: u.pathname + u.search, origin: req.headers.get('origin'), referer: req.headers.get('referer') }), { headers: { 'content-type': 'application/json' } });
  },
  'cdn.example': () => new Response('console.log(1)', { headers: { 'content-type': 'text/javascript' } }),
};

const cleanups: Array<() => Promise<unknown> | void> = [];
afterEach(async () => { for (const c of cleanups.splice(0)) await c(); });

async function setup(policy: TailscalePolicy = {}, extra: Partial<TailscaleRouterOptions> = {}, signIn = true) {
  const fake = createFakeTailscaleClient({ startMs: 1, approveAfterMs: 5, routes });
  const tailscale: Tailscale = createTailscale({ client: () => fake.client, env: { open: () => null, locks: null } });
  const client = fakeWindowClient();
  const env = fakeServiceWorkerContainer(client);
  const router = registerTailscaleRouter({ tailscale, policy, serviceWorkerUrl: SW_URL, env: { serviceWorker: env.container, isSecureContext: true }, ...extra });
  cleanups.push(() => router.dispose(), () => tailscale.dispose());
  await router.ready;
  if (signIn) {
    await tailscale.signIn();
    await until(() => tailscale.getSnapshot().status === 'connected');
  }
  const sw = env.worker()!;
  return { tailscale, fake, router, sw, client };
}

describe('registerTailscaleRouter + tailscale-sw.js', () => {
  it('registers the worker with the policy in its URL and attaches', async () => {
    const { router, sw } = await setup({ hosts: ['api.internal'] });
    expect(router.getState().status).toBe('active');
    expect(sw.scriptUrl).toBe(`${SW_URL}?p=${encodeTailscalePolicy(resolveTailscalePolicy({ hosts: ['api.internal'] }))}`);
    expect(sw.exposed.policy).toMatchObject({ hosts: ['api.internal'] });
  });

  it('routes a matching request through the tailnet: method, body and headers in, status, headers and body out', async () => {
    const { sw, fake, router } = await setup();
    const res = await sw.fetch(new Request('http://nas.example-tailnet.ts.net/notes', {
      method: 'POST', body: 'hello', headers: { authorization: 'Bearer t', cookie: 'session=1', 'content-type': 'text/plain' },
    }));
    expect(res).not.toBeNull();
    expect(res!.headers.get('x-bl-tailscale')).toBe('routed');
    expect(await res!.json()).toEqual({ method: 'POST', path: '/notes', body: 'hello', auth: 'Bearer t', cookie: null });
    expect(fake.requests).toHaveLength(1);
    expect(router.getState().routed).toBe(1);
    expect(sw.network).toHaveLength(0);
  });

  it('streams a body chunk by chunk, and handles null bodies', async () => {
    const { sw } = await setup();
    const res = await sw.fetch(new Request('http://stream.example-tailnet.ts.net/'));
    const reader = res!.body!.getReader();
    const chunks: string[] = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(new TextDecoder().decode(value));
    }
    expect(chunks.join('')).toBe('chunk1;chunk2;chunk3;');
    expect(chunks.length).toBeGreaterThan(1);
    const empty = await sw.fetch(new Request('http://empty.example-tailnet.ts.net/'));
    expect(empty!.status).toBe(204);
  });

  it('adds CORS headers for a cross-origin cors-mode request', async () => {
    const { sw } = await setup();
    const res = await sw.fetch(new Request('http://nas.example-tailnet.ts.net/', { mode: 'cors' }));
    expect(res!.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(res!.headers.get('access-control-expose-headers')).toContain('x-bl-tailscale');
  });

  it('leaves requests that do not match alone (no respondWith)', async () => {
    const { sw } = await setup();
    expect(await sw.fetch(new Request('https://example.com/'))).toBeNull();
    expect(await sw.fetch(new Request(`${ORIGIN}/app.js`))).toBeNull();
    expect(await sw.fetch(new Request('http://localhost:5173/@vite/client'))).toBeNull();
  });

  it('falls back to the network while disconnected, or fails closed', async () => {
    const open = await setup({}, {}, false);
    const res = await open.sw.fetch(new Request('http://nas.example-tailnet.ts.net/'));
    expect(res!.headers.get('x-from')).toBe('network');
    expect(open.sw.network).toHaveLength(1);

    const closed = await setup({ whenUnavailable: 'error' }, {}, false);
    const r2 = await closed.sw.fetch(new Request('http://nas.example-tailnet.ts.net/'));
    expect(r2!.status).toBe(503);
    expect(r2!.headers.get('x-bl-tailscale')).toBe('unavailable');
    expect(closed.sw.network).toHaveLength(0);
  });

  it('follows the connection: signing out sends matched requests back to the network', async () => {
    const { sw, tailscale } = await setup();
    await tailscale.signOut();
    await new Promise((r) => setTimeout(r, 10));
    const res = await sw.fetch(new Request('http://nas.example-tailnet.ts.net/'));
    expect(res!.headers.get('x-from')).toBe('network');
  });

  it('lets shouldRoute send a matched request to the network', async () => {
    const { sw } = await setup({}, { shouldRoute: (r) => !r.url.includes('/public/') });
    const res = await sw.fetch(new Request('http://nas.example-tailnet.ts.net/public/x'));
    expect(res!.headers.get('x-from')).toBe('network');
    const routed = await sw.fetch(new Request('http://nas.example-tailnet.ts.net/private/x'));
    expect(routed!.headers.get('x-bl-tailscale')).toBe('routed');
  });

  it('turns a client error into a failed fetch, and an unknown peer into 502', async () => {
    const { sw, fake } = await setup();
    const peer = await sw.fetch(new Request('http://gone.example-tailnet.ts.net/'));
    expect(peer!.status).toBe(502);
    fake.client.fetch = async () => { throw new Error('dial tcp: timeout'); };
    await expect(sw.fetch(new Request('http://nas.example-tailnet.ts.net/'))).rejects.toThrow('dial tcp: timeout');
  });

  it('refuses bodies over the limit', async () => {
    const { sw, fake } = await setup({ maxBodyBytes: 4, whenUnavailable: 'error' });
    const res = await sw.fetch(new Request('http://nas.example-tailnet.ts.net/', { method: 'PUT', body: 'too long' }));
    expect(res!.status).toBe(503);
    expect(fake.requests).toHaveLength(0);
  });

  it('times out when the page never answers', async () => {
    const { sw, fake } = await setup({ timeoutMs: 30 });
    fake.client.fetch = () => new Promise(() => undefined);
    const res = await sw.fetch(new Request('http://nas.example-tailnet.ts.net/'));
    expect(res!.status).toBe(504);
  });
});

describe('proxied sites (proxyPath)', () => {
  const PAGE = `${ORIGIN}/__tailnet/https/site.example/page?q=1`;
  const open = (sw: Awaited<ReturnType<typeof setup>>['sw'], url = PAGE) => sw.fetch(new Request(url), { mode: 'navigate', destination: 'iframe', resultingClientId: 'frame-1' });

  it('serves the site in the frame, without the headers that would stop it, and its script first', async () => {
    const { sw, fake } = await setup({ proxyPath: '__tailnet/' });
    const res = await open(sw);
    expect(res!.status).toBe(200);
    expect(fake.requests.at(-1)).toMatchObject({ url: 'https://site.example/page?q=1' });
    expect(res!.headers.get('content-security-policy')).toBeNull();
    expect(res!.headers.get('x-frame-options')).toBeNull();
    expect(res!.headers.get('x-site')).toBe('1');
    const html = await res!.text();
    expect(html.indexOf('<script>')).toBe(html.indexOf('<head>') + '<head>'.length);
    expect(html).toContain(JSON.stringify(`${ORIGIN}/__tailnet/`));
    expect(html).toContain(JSON.stringify('https://site.example/page?q=1'));
    expect(html).toContain('<a href="/next">');
  });

  it("routes everything the frame asks for: its own-origin URLs mean the site's, other hosts go as they are", async () => {
    const { sw, fake } = await setup({ proxyPath: '__tailnet/' });
    await open(sw);
    const api = await sw.fetch(new Request(`${ORIGIN}/api/data?x=2`, { method: 'POST', body: '{}' }), { clientId: 'frame-1' });
    expect(await api!.json()).toEqual({ path: '/api/data?x=2', origin: 'https://site.example', referer: null });
    const cdn = await sw.fetch(new Request('https://cdn.example/app.js', { mode: 'cors' }), { clientId: 'frame-1' });
    expect(await cdn!.text()).toBe('console.log(1)');
    expect(cdn!.headers.get('access-control-allow-origin')).toBe(ORIGIN);
    expect(fake.requests.map((r) => r.url)).toEqual(['https://site.example/page?q=1', 'https://site.example/api/data?x=2', 'https://cdn.example/app.js']);
    // Tailscale's own services are never routed, even from a frame; the top page's requests are left to the policy.
    expect(await sw.fetch(new Request('https://controlplane.tailscale.com/key'), { clientId: 'frame-1' })).toBeNull();
    const own = await sw.fetch(new Request(`${ORIGIN}/app.js`), { clientId: 'tab-1' });
    expect(own!.headers.get('x-from')).toBe('network');
    expect(await sw.fetch(new Request(`${ORIGIN}/app.js`), { clientId: 'tab-1' })).toBeNull();
  });

  it('serves a document the page already has (respond) without asking the tailnet again', async () => {
    const respond = (req: { url: string; destination: string }) => (req.destination === 'iframe' && req.url === 'https://site.example/page?q=1'
      ? { url: req.url, status: 200, headers: [['content-type', 'text/html']] as Array<[string, string]>, body: new TextEncoder().encode('<html><head></head>held</html>') }
      : null);
    const { sw, fake } = await setup({ proxyPath: '__tailnet/' }, { respond });
    const html = await (await open(sw))!.text();
    expect(html).toContain('held');
    expect(fake.requests).toHaveLength(0);
  });

  it('shows an error page in the frame when the tailnet is not there, and never falls back to the network', async () => {
    const { sw } = await setup({ proxyPath: '__tailnet/' }, {}, false);
    const res = await open(sw);
    expect(res!.status).toBe(503);
    expect(await res!.text()).toContain('bl-tailnet-frame');
    expect(sw.network).toHaveLength(0);
  });

  it('builds and reads proxy addresses', () => {
    expect(tailscaleProxyUrl('https://www.youtube.com/watch?v=1#t', `${ORIGIN}/ui/`)).toBe(`${ORIGIN}/ui/__tailnet/https/www.youtube.com/watch?v=1#t`);
    expect(tailscaleProxyTarget(`${ORIGIN}/ui/__tailnet/http/nas:8080?x`, `${ORIGIN}/ui/`)).toBe('http://nas:8080/?x');
    expect(tailscaleProxyTarget(`${ORIGIN}/ui/other`, `${ORIGIN}/ui/`)).toBeNull();
    expect(() => resolveTailscalePolicy({ proxyPath: '../x' })).toThrow(/proxyPath/);
  });
});

describe('the worker on its own', () => {
  it('ignores attach messages from iframes', async () => {
    const sw = loadServiceWorker(`${SW_URL}?p=${encodeTailscalePolicy(resolveTailscalePolicy({ whenUnavailable: 'error', timeoutMs: 50 }))}`);
    const frame = fakeWindowClient('frame', 'nested');
    sw.clients.push(frame);
    const ch = new MessageChannel();
    let requests = 0;
    ch.port1.onmessage = (e) => { if ((e.data as { type: string }).type === 'request') requests++; };
    sw.message({ type: 'bl-ts/attach', v: 1, connected: true }, frame, [ch.port2]);
    const res = await sw.fetch(new Request('http://nas.example-tailnet.ts.net/'));
    expect(res!.status).toBe(503);
    expect(requests).toBe(0);
    expect(frame.received).toContainEqual({ type: 'bl-ts/needs-attach', v: 1 }); // it asked windows to attach
    ch.port1.close();
  });

  it('asks windows to re-attach after a restart, and serves once one does', async () => {
    const sw = loadServiceWorker(SW_URL);
    const tab = fakeWindowClient();
    sw.clients.push(tab);
    const ch = new MessageChannel();
    ch.port1.onmessage = (e) => {
      const m = e.data as { type: string; id: number };
      if (m.type !== 'request') return;
      ch.port1.postMessage({ type: 'head', id: m.id, status: 200, headers: [['content-type', 'text/plain']] });
      const data = new TextEncoder().encode('late owner').buffer;
      ch.port1.postMessage({ type: 'chunk', id: m.id, data }, [data]);
      ch.port1.postMessage({ type: 'end', id: m.id });
    };
    (tab as unknown as { onMessage: (m: unknown) => void }).onMessage = (m) => {
      if ((m as { type: string }).type === 'bl-ts/needs-attach') sw.message({ type: 'bl-ts/attach', v: 1, connected: true }, tab, [ch.port2]);
    };
    const res = await sw.fetch(new Request('http://nas.example-tailnet.ts.net/'));
    expect(await res!.text()).toBe('late owner');
    ch.port1.close();
  });
});

describe('support and URLs', () => {
  it('needs a secure context and service workers', () => {
    expect(tailscaleRouterUnsupportedReason({ isSecureContext: false, serviceWorker: null })).toMatch(/HTTPS/);
    expect(tailscaleRouterUnsupportedReason({ isSecureContext: true, serviceWorker: null })).toMatch(/no service workers/);
  });
  it('builds the script URL relative to a base', () => {
    const u = new URL(tailscaleServiceWorkerUrl(resolveTailscalePolicy(), 'tailscale-sw.js', 'https://site.example/ui/#/x'));
    expect(u.pathname).toBe('/ui/tailscale-sw.js');
    expect(u.searchParams.get('p')).toBeTruthy();
  });
  it('reports unsupported instead of throwing', async () => {
    const fake = createFakeTailscaleClient();
    const router = registerTailscaleRouter({ tailscale: createTailscale({ client: fake.client }), env: { isSecureContext: false, serviceWorker: null } });
    expect((await router.ready).status).toBe('unsupported');
    await router.dispose();
  });
});
