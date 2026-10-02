import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  TailscaleError, createTailscale, createTailscaleFetch, isSafeLoginUrl, memoryTailscalePersistence, tailscaleErrorMessage, toResponse,
  toTailscaleRequest, vaultTailscalePersistence, webStorageTailscalePersistence, type TailscaleClient, type TailscaleOptions, type TailscalePopup,
  type TailscaleSnapshot,
} from '@/lib/tailscale';
import { createFakeTailscaleClient } from '@/lib/tailscale-fake';

const until = async (check: () => boolean, ms = 3000) => {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 5));
  }
};

function fakePopup() {
  const popup = {
    closed: false,
    opener: {} as unknown,
    replaced: [] as string[],
    close() { popup.closed = true; },
    location: { replace(url: string) { popup.replaced.push(url); } },
    document: { title: '', body: { textContent: '' as string | null } },
  };
  return popup;
}

function setup(extra: Partial<TailscaleOptions> = {}, fakeOptions: Parameters<typeof createFakeTailscaleClient>[0] = {}) {
  const fake = createFakeTailscaleClient({ startMs: 1, approveAfterMs: 10, ...fakeOptions });
  const popup = fakePopup();
  const open = vi.fn((): TailscalePopup | null => popup);
  const statuses: string[] = [];
  const t = createTailscale({ client: () => fake.client, env: { open, locks: null }, ...extra });
  t.subscribe(() => { const s = t.getSnapshot().status; if (statuses.at(-1) !== s) statuses.push(s); });
  return { t, fake, popup, open, statuses };
}

const disposers: Array<() => Promise<void>> = [];
afterEach(async () => { await Promise.all(disposers.splice(0).map((d) => d())); });

describe('interactive sign-in', () => {
  it('opens a popup at once, sends it to the login URL, and is connected once approved', async () => {
    const { t, popup, open, statuses, fake } = setup();
    disposers.push(t.dispose);
    expect(fake.starts).toBe(0); // nothing created before sign-in
    const p = t.signIn();
    expect(open).toHaveBeenCalledTimes(1); // synchronously, inside the press
    expect(popup.document.body.textContent).toBe('Waiting for Tailscale…');
    await p;
    await until(() => t.getSnapshot().status === 'connected');
    expect(popup.replaced[0]).toMatch(/^https:\/\/login\.tailscale\.example\/a\//);
    expect(popup.opener).toBeNull();
    expect(popup.closed).toBe(true);
    expect(statuses).toEqual(['signing-in', 'loading', 'signing-in', 'connected']);
    const s = t.getSnapshot();
    expect(s.selfName).toMatch(/^bl-[a-z0-9]{6}\.example-tailnet\.ts\.net$/);
    expect(s.tailnet).toBe('example-tailnet.ts.net');
    expect(s.addresses).toContain('100.100.7.42');
    expect(s.loginUrl).toBeNull();
    expect(fake.starts).toBe(1);
  });

  it('without a popup, exposes the URL and calls onLoginUrl; cancel goes back', async () => {
    const onLoginUrl = vi.fn();
    const { t } = setup({ env: { open: () => null, locks: null }, onLoginUrl }, { approveAfterMs: false });
    disposers.push(t.dispose);
    await t.signIn();
    await until(() => t.getSnapshot().loginUrl !== null);
    expect(t.getSnapshot().status).toBe('signing-in');
    expect(onLoginUrl).toHaveBeenCalledWith(t.getSnapshot().loginUrl);
    t.cancel();
    expect(t.getSnapshot()).toMatchObject({ status: 'needs-login', loginUrl: null });
  });

  it('refuses a login URL that is not https', async () => {
    // eslint-disable-next-line no-script-url -- the URL a hostile control server might send
    const { t, popup } = setup({}, { loginUrl: 'javascript:alert(1)', approveAfterMs: false });
    disposers.push(t.dispose);
    await t.signIn();
    await until(() => t.getSnapshot().status === 'error');
    expect(t.getSnapshot().error?.reason).toBe('login-url');
    expect(popup.replaced).toEqual([]);
    expect(popup.closed).toBe(true);
    expect(isSafeLoginUrl('http://localhost:8080/register')).toBe(true);
    expect(isSafeLoginUrl('http://login.example/')).toBe(false);
    expect(isSafeLoginUrl('data:text/html,hi')).toBe(false);
  });

  it('reports a client that fails to start, a crash, and no client at all', async () => {
    const a = setup({}, { failStart: 'wasm failed' });
    disposers.push(a.t.dispose);
    await a.t.signIn();
    expect(a.t.getSnapshot().status).toBe('error');
    expect(a.t.getSnapshot().error?.message).toContain('wasm failed');
    expect(a.popup.closed).toBe(true);

    const b = setup();
    disposers.push(b.t.dispose);
    await b.t.signIn();
    await until(() => b.t.getSnapshot().status === 'connected');
    b.fake.crash('panic: ValueOf: invalid value');
    expect(b.t.getSnapshot().error).toMatchObject({ reason: 'client', message: 'panic: ValueOf: invalid value' });
    await b.t.signIn(); // retry starts a new client
    await until(() => b.t.getSnapshot().status === 'connected');

    const c = createTailscale({ env: { open: () => null, locks: null } });
    await c.signIn();
    expect(c.getSnapshot().error?.reason).toBe('no-client');
    expect(tailscaleErrorMessage(c.getSnapshot().error)).toBe('Tailscale is not set up on this page.');
  });
});

describe('auth keys', () => {
  it('fetches a key, signs in without a popup, and never stores the key', async () => {
    const persistence = memoryTailscalePersistence();
    const authKey = vi.fn(async () => 'demo-not-a-real-key');
    const { t, open } = setup({ auth: { mode: 'auth-key', authKey }, persistence });
    disposers.push(t.dispose);
    await t.signIn();
    await until(() => t.getSnapshot().status === 'connected');
    expect(open).not.toHaveBeenCalled();
    expect(authKey).toHaveBeenCalledTimes(1);
    await until(() => t.getSnapshot().hasSession);
    expect(JSON.stringify(await persistence.load())).not.toContain('demo-not-a-real-key');
  });

  it('fails when the key provider fails, and when the key is not accepted in time', async () => {
    const a = setup({ auth: { mode: 'auth-key', authKey: async () => { throw new Error('401'); } } });
    disposers.push(a.t.dispose);
    await a.t.signIn();
    expect(a.t.getSnapshot().error).toMatchObject({ reason: 'auth-key' });

    const b = setup({ auth: { mode: 'auth-key', authKey: 'wrong' }, authKeyTimeoutMs: 40 }, { acceptKeys: ['right'] });
    disposers.push(b.t.dispose);
    await b.t.signIn();
    expect(b.t.getSnapshot().status).toBe('signing-in');
    await until(() => b.t.getSnapshot().status === 'error');
    expect(b.t.getSnapshot().error?.reason).toBe('auth-key');
  });
});

describe('sessions', () => {
  it('saves the node state, restores it on activation without a sign-in, and forgets it on sign-out', async () => {
    const persistence = memoryTailscalePersistence();
    const first = setup({ persistence, hostname: 'kiosk' });
    await first.t.signIn();
    await until(() => first.t.getSnapshot().hasSession);
    const saved = await persistence.load();
    expect(saved).toMatchObject({ v: 1, hostname: 'kiosk', state: { _machinekey: 'fake-machine-key' } });
    await first.t.dispose();

    const second = setup({ persistence });
    const release = second.t.activate();
    await until(() => second.t.getSnapshot().status === 'connected');
    expect(second.open).not.toHaveBeenCalled();
    expect(second.t.getSnapshot().selfName).toBe('kiosk.example-tailnet.ts.net');

    await second.t.signOut();
    expect(second.t.getSnapshot()).toMatchObject({ status: 'idle', hasSession: false, selfName: null });
    expect(await persistence.load()).toBeNull();
    release();
  });

  it('disconnect keeps the session; connect resumes it; autoConnect false waits', async () => {
    const persistence = memoryTailscalePersistence();
    const { t } = setup({ persistence, autoConnect: false });
    await t.signIn();
    await until(() => t.getSnapshot().hasSession);
    await t.disconnect();
    expect(t.getSnapshot()).toMatchObject({ status: 'idle', hasSession: true });
    const release = t.activate();
    await new Promise((r) => setTimeout(r, 30));
    expect(t.getSnapshot().status).toBe('idle');
    await t.connect();
    await until(() => t.getSnapshot().status === 'connected');
    release();
    await t.dispose();
  });

  it('a StrictMode-style activate, release, activate keeps one client', async () => {
    const persistence = memoryTailscalePersistence();
    await persistence.save({ v: 1, hostname: 'h', state: { k: 'v' } });
    const { t, fake } = setup({ persistence });
    const r1 = t.activate();
    r1();
    const r2 = t.activate();
    await until(() => t.getSnapshot().status === 'connected');
    expect(fake.starts).toBe(1);
    r2();
    await new Promise((r) => setTimeout(r, 10));
    expect(t.getSnapshot().status).toBe('idle'); // released: stopped
  });

  it('web storage and vault adapters', async () => {
    const map = new Map<string, string>();
    const storage = { getItem: (k: string) => map.get(k) ?? null, setItem: (k: string, v: string) => void map.set(k, v), removeItem: (k: string) => void map.delete(k) };
    const ws = webStorageTailscalePersistence(storage, 'k');
    await ws.save({ v: 1, hostname: 'h', state: { a: 'b' } });
    expect(await ws.load()).toEqual({ v: 1, hostname: 'h', state: { a: 'b' } });
    map.set('k', '{"v":1,"hostname":"h","state":{"a":1}}');
    expect(await ws.load()).toBeNull(); // not a session: ignored
    map.set('k', 'not json');
    expect(await ws.load()).toBeNull();

    const records = new Map<string, unknown>();
    let locked = false;
    const vault = {
      get: async <T,>(n: string) => { if (locked) throw new Error('locked'); return records.get(n) as T | undefined; },
      put: async (n: string, v: unknown) => { if (locked) throw new Error('locked'); records.set(n, v); },
      delete: async (n: string) => { records.delete(n); },
    };
    const vp = vaultTailscalePersistence(vault);
    await vp.save({ v: 1, hostname: 'h', state: {} });
    expect(records.has('tailscale-session')).toBe(true);
    expect(await vp.load()).toEqual({ v: 1, hostname: 'h', state: {} });

    // a locked vault: the controller reports a storage error instead of signing in as a new device
    locked = true;
    const { t } = setup({ persistence: vp });
    await t.signIn();
    expect(t.getSnapshot().error?.reason).toBe('storage');
    await t.dispose();
  });

  it('warns, but stays connected, when saving fails', async () => {
    const persistence = { ...memoryTailscalePersistence(), save: async () => { throw new Error('quota'); } };
    const { t } = setup({ persistence });
    disposers.push(t.dispose);
    await t.signIn();
    await until(() => t.getSnapshot().warning !== null);
    await until(() => t.getSnapshot().status === 'connected');
  });
});

describe('one node per origin', () => {
  it('a second tab without the lock reports other-tab', async () => {
    const held = new Set<string>();
    const locks = {
      request: (async (name: string, _opts: unknown, cb: (lock: unknown) => unknown) => {
        if (held.has(name)) return cb(null);
        held.add(name);
        await cb({ name });
        held.delete(name);
      }) as unknown as LockManager['request'],
    };
    const a = setup({ env: { open: () => null, locks } });
    const b = setup({ env: { open: () => null, locks } });
    await a.t.signIn();
    await until(() => a.t.getSnapshot().status === 'connected');
    await b.t.signIn();
    expect(b.t.getSnapshot().error?.reason).toBe('other-tab');
    expect(b.fake.starts).toBe(0);
    await a.t.dispose(); // releases the lock
    await new Promise((r) => setTimeout(r, 5));
    await b.t.signIn();
    await until(() => b.t.getSnapshot().status === 'connected');
    await b.t.dispose();
  });
});

describe('fetch', () => {
  const routes = {
    'nas.example-tailnet.ts.net': async (req: Request) => new Response(`${req.method} ${new URL(req.url).pathname} ${await req.text()}`, { status: 201, headers: { 'x-peer': 'nas' } }),
  };

  it('refuses while not connected, then goes through the client', async () => {
    const { t, fake } = setup({}, { routes });
    disposers.push(t.dispose);
    await expect(t.fetch({ url: 'http://nas.example-tailnet.ts.net/' })).rejects.toMatchObject({ reason: 'not-connected' });
    await t.signIn();
    await until(() => t.getSnapshot().status === 'connected');
    const res = toResponse(await t.fetch(await toTailscaleRequest('http://nas.example-tailnet.ts.net/a', { method: 'POST', body: 'hi' })));
    expect(res.status).toBe(201);
    expect(await res.text()).toBe('POST /a hi');
    expect(fake.requests[0]).toMatchObject({ method: 'POST' });
  });

  it('createTailscaleFetch routes by policy and falls back (or fails closed)', async () => {
    const fallback = vi.fn(async () => new Response('network'));
    const { t } = setup({ policy: { whenUnavailable: 'network' } }, { routes });
    disposers.push(t.dispose);
    const f = createTailscaleFetch(t, fallback);
    expect(await (await f('http://nas.example-tailnet.ts.net/x')).text()).toBe('network'); // not connected yet
    await t.signIn();
    await until(() => t.getSnapshot().status === 'connected');
    expect(await (await f('http://nas.example-tailnet.ts.net/x')).text()).toBe('GET /x ');
    expect(await (await f('https://example.com/')).text()).toBe('network');
    expect(fallback).toHaveBeenCalledTimes(2);

    const closed = setup({ policy: { whenUnavailable: 'error' } });
    const g = createTailscaleFetch(closed.t, fallback);
    expect((await g('http://nas.example-tailnet.ts.net/x')).status).toBe(503);
  });

  it('toResponse handles null-body and impossible statuses', async () => {
    expect(toResponse({ status: 204, headers: [], body: new Uint8Array([1]) }).body).toBeNull();
    expect(toResponse({ status: 0, headers: [['bad header', 'x'], ['ok', 'y']], body: null })).toMatchObject({ status: 502 });
  });
});

describe('snapshots', () => {
  it('are stable between changes and idle on the server', () => {
    const t = createTailscale({ client: {} as TailscaleClient });
    const a: TailscaleSnapshot = t.getSnapshot();
    expect(t.getSnapshot()).toBe(a);
    expect(t.getServerSnapshot().status).toBe('idle');
    expect(new TailscaleError('client', 'x')).toBeInstanceOf(Error);
  });
});
