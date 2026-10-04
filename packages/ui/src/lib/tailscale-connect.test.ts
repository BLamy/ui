import { describe, expect, it, vi } from 'vitest';
import { createTailscale, toResponse } from '@/lib/tailscale';
import { createTailscaleConnectClient, exitNodeSettings, isPublicName, keepCorpDns, type TailscaleConnectModule, type TailscaleIpn } from '@/lib/tailscale-connect';

/** A stand-in for @agent-wasm/tailscale-connect's IPN, shaped after its pkg.d.ts. */
function fakeModule() {
  let callbacks: Parameters<TailscaleIpn['run']>[0] | null = null;
  const calls: unknown[] = [];
  let config: Parameters<TailscaleConnectModule['createIPN']>[0] | null = null;
  const ipn: TailscaleIpn = {
    run: (cb) => { callbacks = cb; cb.notifyState('NeedsLogin'); },
    login: () => {
      callbacks?.notifyBrowseToURL('https://login.tailscale.com/a/abc');
      setTimeout(() => {
        config?.stateStorage?.setState('_machinekey', 'mk');
        callbacks?.notifyNetMap(JSON.stringify({ self: { name: 'laptop.tail1234.ts.net.', addresses: ['100.64.1.2'] }, peers: [] }));
        callbacks?.notifyState('Running');
      }, 5);
    },
    logout: () => callbacks?.notifyState('NeedsLogin'),
    fetch: async (req) => {
      calls.push(req);
      return { status: 200, statusText: 'OK', headers: { 'content-type': 'text/plain' }, bodyBase64: btoa('pong') };
    },
  };
  const mod: TailscaleConnectModule = { createIPN: vi.fn(async (c) => { config = c; return ipn; }) };
  return { mod, calls, panic: (m: string) => config?.panicHandler(m), getConfig: () => config };
}

describe('createTailscaleConnectClient', () => {
  it('loads nothing until start, then drives createIPN, run, login, state storage and fetch', async () => {
    const f = fakeModule();
    const load = vi.fn(async () => f.mod);
    const client = createTailscaleConnectClient({ wasmURL: '/assets/main.wasm', load });
    const t = createTailscale({ client, controlUrl: 'https://headscale.example', hostname: 'laptop', env: { open: () => null, locks: null } });
    expect(load).not.toHaveBeenCalled();
    await t.signIn();
    expect(load).toHaveBeenCalledTimes(1);
    expect(f.getConfig()).toMatchObject({ authKey: '', controlURL: 'https://headscale.example', hostname: 'laptop', wasmURL: '/assets/main.wasm' });
    await vi.waitFor(() => expect(t.getSnapshot().status).toBe('connected'));
    expect(t.getSnapshot()).toMatchObject({ selfName: 'laptop.tail1234.ts.net', tailnet: 'tail1234.ts.net', addresses: ['100.64.1.2'] });

    // a simple GET goes as a URL string (the minimal build's shape); anything else as the structured request
    const a = toResponse(await t.fetch({ url: 'http://nas.tail1234.ts.net/' }));
    expect(await a.text()).toBe('pong');
    await t.fetch({ url: 'http://nas.tail1234.ts.net/', method: 'POST', headers: [['x-a', '1']], body: new TextEncoder().encode('hi') });
    expect(f.calls[0]).toBe('http://nas.tail1234.ts.net/');
    expect(f.calls[1]).toEqual({ url: 'http://nas.tail1234.ts.net/', method: 'POST', headers: { 'x-a': '1' }, bodyBase64: btoa('hi'), redirect: undefined });

    f.panic('runtime: out of memory');
    expect(t.getSnapshot().error?.message).toBe('runtime: out of memory');
    await t.dispose();
  });

  it('asks for the tailnet DNS, and keeps CorpDNS on in the stored profile (as almostnode does)', async () => {
    const f = fakeModule();
    const t = createTailscale({ client: createTailscaleConnectClient({ wasmURL: '/w', load: async () => f.mod }), env: { open: () => null, locks: null } });
    await t.signIn();
    expect(f.getConfig()).toMatchObject({ CorpDNS: true, corpDNS: true, dnsIP: '100.100.100.100' });
    const hex = (s: string) => Array.from(new TextEncoder().encode(s), (b) => b.toString(16).padStart(2, '0')).join('');
    const unhex = (h: string) => new TextDecoder().decode(Uint8Array.from(h.match(/../g) ?? [], (x) => parseInt(x, 16)));
    expect(JSON.parse(unhex(keepCorpDns('profile-a1', hex('{"CorpDNS":false,"Hostname":"x"}'))))).toEqual({ CorpDNS: true, Hostname: 'x' });
    expect(keepCorpDns('_machinekey', hex('{"CorpDNS":false}'))).toBe(hex('{"CorpDNS":false}'));
    expect(keepCorpDns('profile-a1', 'zz')).toBe('zz');
    await t.dispose();
  });

  it('needs a wasmURL', async () => {
    const t = createTailscale({ client: createTailscaleConnectClient({ wasmURL: '', load: async () => fakeModule().mod }), env: { open: () => null, locks: null } });
    await t.signIn();
    expect(t.getSnapshot().error?.message).toMatch(/wasmURL/);
  });
});

/** An IPN with exit nodes: the net map offers one, `configure` applies it, and only then do public addresses answer. */
function exitNodeModule() {
  let callbacks: Parameters<TailscaleIpn['run']>[0] | null = null;
  const fetches: Array<string | Parameters<TailscaleIpn['fetch']>[0]> = [];
  const configured: Array<Record<string, unknown>> = [];
  let selected: string | null = null;
  const sendMap = () => callbacks?.notifyNetMap(JSON.stringify({
    self: { name: 'laptop.tail1234.ts.net.', addresses: ['100.64.1.2'] },
    peers: [{ id: 'nExit1', name: 'exit.tail1234.ts.net.', addresses: ['100.64.9.9'], online: true, exitNodeOption: true }, { id: 'nNas', name: 'nas.tail1234.ts.net.', addresses: ['100.64.2.2'], online: true }],
    selectedExitNodeId: selected,
  }));
  const ipn: TailscaleIpn = {
    run: (cb) => { callbacks = cb; cb.notifyState('Running'); sendMap(); },
    login: () => {},
    logout: () => {},
    configure: async (config) => { configured.push(config); selected = (config.exitNodeId as string | null) ?? null; sendMap(); },
    fetch: async (req) => {
      fetches.push(req);
      const url = typeof req === 'string' ? req : req.url;
      if (new URL(url).pathname === '/dns-query') {
        const name = new URL(url).searchParams.get('name');
        if (name === 'nowhere.example') return { status: 200, headers: {}, text: async () => JSON.stringify({ Status: 3 }) };
        return { status: 200, headers: {}, text: async () => JSON.stringify({ Status: 0, Answer: [{ type: 1, TTL: 120, data: name === 'example.com' ? '93.184.216.34' : '10.0.0.1' }] }) };
      }
      return { status: 200, statusText: 'OK', headers: { 'content-type': 'text/plain' }, bodyBase64: btoa(`served ${url}`) };
    },
  };
  const mod: TailscaleConnectModule = { createIPN: vi.fn(async () => ipn) };
  return { mod, fetches, configured };
}

describe('exit nodes', () => {
  const connect = async (extra: Parameters<typeof createTailscaleConnectClient>[0] extends infer O ? Partial<O> : never = {}) => {
    const f = exitNodeModule();
    const t = createTailscale({ client: createTailscaleConnectClient({ wasmURL: '/w', load: async () => f.mod, ...extra }), auth: { mode: 'auth-key', authKey: 'k' }, env: { open: () => null, locks: null } });
    await t.signIn();
    await vi.waitFor(() => expect(t.getSnapshot().status).toBe('connected'));
    return { t, f };
  };

  it('lists the peers that offer to be exit nodes, with their ids', async () => {
    const { t } = await connect();
    expect(t.getSnapshot().peers).toEqual([
      { name: 'exit.tail1234.ts.net', addresses: ['100.64.9.9'], online: true, id: 'nExit1', exitNode: true },
      { name: 'nas.tail1234.ts.net', addresses: ['100.64.2.2'], online: true, id: 'nNas', exitNode: false },
    ]);
    expect(t.getSnapshot().exitNodeId).toBeNull();
    await t.dispose();
  });

  it('applies an exit node with configure (both spellings, DNS on) and reports it from the net map', async () => {
    const { t, f } = await connect();
    await t.setExitNode('nExit1');
    expect(f.configured).toHaveLength(1);
    expect(f.configured[0]).toMatchObject({ useExitNode: true, routeAll: true, RouteAll: true, exitNodeId: 'nExit1', exitNodeID: 'nExit1', ExitNodeID: 'nExit1', CorpDNS: true, dnsIP: '100.100.100.100' });
    expect(t.getSnapshot().exitNodeId).toBe('nExit1');
    await t.setExitNode(null);
    expect(f.configured[1]).toMatchObject({ useExitNode: false, routeAll: false, ExitNodeID: null });
    expect(t.getSnapshot().exitNodeId).toBeNull();
    await t.dispose();
  });

  it('only accepts a peer that offers to be an exit node, and only while connected', async () => {
    const { t } = await connect();
    await expect(t.setExitNode('nNas')).rejects.toMatchObject({ reason: 'client', message: expect.stringMatching(/not an exit node/) });
    await expect(t.setExitNode('nope')).rejects.toMatchObject({ reason: 'client' });
    await t.dispose();
    await expect(t.setExitNode('nExit1')).rejects.toMatchObject({ reason: 'not-connected' });
  });

  it('rejects a client that cannot configure', async () => {
    const f = exitNodeModule();
    const ipn = await f.mod.createIPN({} as never);
    delete (ipn as { configure?: unknown }).configure;
    const t = createTailscale({ client: createTailscaleConnectClient({ wasmURL: '/w', load: async () => ({ createIPN: async () => ipn }) }), auth: { mode: 'auth-key', authKey: 'k' }, env: { open: () => null, locks: null } });
    await t.signIn();
    await vi.waitFor(() => expect(t.getSnapshot().status).toBe('connected'));
    await expect(t.setExitNode('nExit1')).rejects.toMatchObject({ message: expect.stringMatching(/cannot change its exit node|not an exit node/) });
    await t.dispose();
  });

  it('with an exit node: looks a public name up through the tailnet, then dials the address with the name as Host and SNI', async () => {
    const { t, f } = await connect();
    await t.setExitNode('nExit1');
    const res = toResponse(await t.fetch({ url: 'https://example.com/a?b=1', headers: [['accept', 'text/html']] }));
    expect(await res.text()).toBe('served https://93.184.216.34/a?b=1');
    // The DoH lookup is itself a tailnet request: an IP-literal URL, so it needs no name resolution and goes through the exit node.
    expect(f.fetches[0]).toMatchObject({ url: expect.stringMatching(/^https:\/\/1\.1\.1\.1\/dns-query\?name=example\.com&type=A$/), headers: { accept: 'application/dns-json' } });
    expect(f.fetches[1]).toEqual({ url: 'https://93.184.216.34/a?b=1', method: 'GET', headers: { accept: 'text/html', Host: 'example.com' }, bodyBase64: undefined, redirect: undefined, tlsServerName: 'example.com' });
    await t.dispose();
  });

  it('keeps the page-visible URL (not the address) in the response, and caches the lookup', async () => {
    const { t, f } = await connect();
    await t.setExitNode('nExit1');
    const first = await t.fetch({ url: 'http://example.com/' });
    expect(first.url).toBe('http://example.com/');
    await t.fetch({ url: 'http://example.com/other' });
    expect(f.fetches.filter((r) => typeof r !== 'string' && r.url.includes('dns-query'))).toHaveLength(1);
    expect(f.fetches.at(-1)).toMatchObject({ url: 'http://93.184.216.34/other', headers: { Host: 'example.com' } });
    expect((f.fetches.at(-1) as { tlsServerName?: string }).tlsServerName).toBeUndefined(); // http: no TLS
    await t.dispose();
  });

  it('does not look up tailnet names, addresses or short names, and does not touch them without an exit node', async () => {
    const { t, f } = await connect();
    await t.fetch({ url: 'http://example.com/' }); // no exit node: the client is asked as before
    expect(f.fetches).toEqual(['http://example.com/']);
    await t.setExitNode('nExit1');
    f.fetches.length = 0;
    for (const url of ['http://nas.tail1234.ts.net/', 'http://100.64.2.2/', 'http://nas/', 'http://localhost:3000/', 'http://[fd7a:115c:a1e0::1]/']) await t.fetch({ url });
    expect(f.fetches.every((r) => typeof r === 'string' && !r.includes('dns-query'))).toBe(true);
    await t.dispose();
  });

  it('uses the DoH endpoint it is given, and reports a name that has no address', async () => {
    const { t, f } = await connect({ dohUrl: 'https://9.9.9.9/dns-query' });
    await t.setExitNode('nExit1');
    await t.fetch({ url: 'http://example.com/' });
    expect(f.fetches[0]).toMatchObject({ url: expect.stringContaining('https://9.9.9.9/dns-query?name=example.com') });
    await expect(t.fetch({ url: 'http://nowhere.example/' })).rejects.toThrow(/nowhere\.example has no address/);
    await t.dispose();
  });

  it('knows which names need public DNS, and builds the settings it sends', () => {
    for (const host of ['example.com', 'www.youtube.com', 'a.b.c.example.org', 'EXAMPLE.com.']) expect(isPublicName(host), host).toBe(true);
    for (const host of ['nas', 'nas.tail1234.ts.net', '100.64.1.2', '8.8.8.8', 'localhost', 'app.localhost', '[::1]', 'fd7a:115c:a1e0::1']) expect(isPublicName(host), host).toBe(false);
    expect(exitNodeSettings('n1')).toMatchObject({ useExitNode: true, RouteAll: true, ExitNodeID: 'n1', CorpDNS: true });
    expect(exitNodeSettings(null)).toMatchObject({ useExitNode: false, RouteAll: false, ExitNodeID: null, CorpDNS: true });
  });
});

