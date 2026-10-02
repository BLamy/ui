import { describe, expect, it, vi } from 'vitest';
import { createTailscale, toResponse } from '@/lib/tailscale';
import { createTailscaleConnectClient, keepCorpDns, type TailscaleConnectModule, type TailscaleIpn } from '@/lib/tailscale-connect';

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
