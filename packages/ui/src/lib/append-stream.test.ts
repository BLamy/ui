import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LocalStreams, StreamFullError } from './append-stream';
import { CloudSync, DurableStreamsClient } from './durable-streams';

/** A Durable Streams server in memory: the protocol subset the client uses (PUT, POST with idempotent producers, GET from an offset). */
function fakeServer() {
  const streams = new Map<string, unknown[]>();
  const producers = new Map<string, number>();
  const log: string[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const name = decodeURIComponent(url.pathname.split('/v1/stream/')[1]);
    const method = init.method ?? 'GET';
    const h = (init.headers ?? {}) as Record<string, string>;
    log.push(`${method} ${name}`);
    if (method === 'PUT') {
      if (streams.has(name)) return new Response(null, { status: 409 });
      streams.set(name, []);
      return new Response(null, { status: 201 });
    }
    const items = streams.get(name);
    if (!items) return new Response(null, { status: 404 });
    if (method === 'POST') {
      const pid = h['Producer-Id'], seq = Number(h['Producer-Seq']);
      if (pid) {
        const expected = producers.get(`${name}|${pid}`) ?? 0;
        if (seq < expected) return new Response(null, { status: 409, headers: { 'Producer-Expected-Seq': String(expected) } });
        producers.set(`${name}|${pid}`, seq + 1);
      }
      items.push(...JSON.parse(init.body as string));
      return new Response(null, { status: 204 });
    }
    const offset = url.searchParams.get('offset');
    const from = offset === '-1' || offset === null ? 0 : Number(offset);
    return new Response(JSON.stringify(items.slice(from)), { status: 200, headers: { 'Stream-Next-Offset': String(items.length), 'Stream-Up-To-Date': 'true' } });
  }) as typeof fetch;
  return { streams, fetch: fetchFn, log };
}

/** The tests run under node, which has no localStorage: a map with the same surface. */
class MemStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
  removeItem(k: string) { this.m.delete(k); }
  clear() { this.m.clear(); }
}
let mem: MemStorage;
beforeEach(() => {
  mem = new MemStorage();
  vi.stubGlobal('localStorage', mem);
  vi.stubGlobal('addEventListener', () => undefined);
  vi.stubGlobal('removeEventListener', () => undefined);
});

describe('LocalStreams', () => {
  it('appends in order and reads ranges', async () => {
    const s = new LocalStreams();
    expect(await s.append('a', [1, 2, 3])).toBe(0);
    expect(await s.append('a', [4, 5])).toBe(3);
    expect(s.length('a')).toBe(5);
    expect(await s.read('a')).toEqual([1, 2, 3, 4, 5]);
    expect(await s.read('a', 2, 4)).toEqual([3, 4]);
    expect(s.names()).toEqual(['a']);
  });

  it('never rewrites a key: each append is a new one', async () => {
    const s = new LocalStreams();
    await s.append('a', [1]);
    const first = [...Array(mem.length).keys()].map((i) => [mem.key(i) as string, mem.getItem(mem.key(i) as string)]);
    await s.append('a', [2]);
    for (const [k, v] of first) expect(mem.getItem(k as string)).toBe(v);
    expect(mem.length).toBe(2);
  });

  it('keeps concurrent appends and a sync append in offset order', async () => {
    const s = new LocalStreams();
    const slow = s.append('a', ['x', 'y']);
    s.appendSync('a', ['z']);
    await slow;
    expect(await s.read('a')).toEqual(['x', 'y', 'z']);
  });

  it('keeps streams apart, names with slashes and colons included', async () => {
    const s = new LocalStreams();
    await s.append('session/a:b', [1]);
    await s.append('sessions', [2]);
    expect(s.names().sort()).toEqual(['session/a:b', 'sessions']);
    expect(await s.read('session/a:b')).toEqual([1]);
    s.remove('session/a:b');
    expect(s.names()).toEqual(['sessions']);
  });

  it('asks evict for room when storage is full, then fails without it', async () => {
    const real = mem.setItem.bind(mem);
    let full = true;
    mem.setItem = (k: string, v: string) => { if (full && k.startsWith('bl-stream:b')) throw new DOMException('full', 'QuotaExceededError'); real(k, v); };
    const s = new LocalStreams({ evict: () => { full = false; return true; } });
    await s.append('b', [2]);
    expect(await s.read('b')).toEqual([2]);
    full = true;
    await expect(new LocalStreams().append('b', [3])).rejects.toBeInstanceOf(StreamFullError);
  });
});

describe('CloudSync', () => {
  const cfg = { enabled: true, url: 'https://x.rivet.run/durable-streams', token: 't', prefix: '' };

  it('stays off, and sends nothing, until configured', async () => {
    const srv = fakeServer();
    const local = new LocalStreams();
    const cloud = new CloudSync(local);
    await local.append('a', [1]);
    await new Promise((r) => setTimeout(r, 30));
    expect(cloud.getStatus().state).toBe('off');
    expect(srv.log).toEqual([]);
  });

  it('mirrors streams in order, once, and keeps up as they grow', async () => {
    const srv = fakeServer();
    const local = new LocalStreams();
    await local.append('s', [1, 2, 3]);
    const cloud = new CloudSync(local, [], { fetch: srv.fetch });
    cloud.configure(cfg);
    await vi_waitFor(() => srv.streams.get('s')?.length === 3);
    await local.append('s', [4]);
    await vi_waitFor(() => srv.streams.get('s')?.length === 4);
    expect(srv.streams.get('s')).toEqual([1, 2, 3, 4]);
    expect(cloud.getStatus().pending).toBe(0);
    cloud.stop();
  });

  it('counts a replayed producer write as done instead of duplicating it', async () => {
    const srv = fakeServer();
    const client = new DurableStreamsClient({ url: cfg.url, fetch: srv.fetch });
    await client.create('s');
    await client.append('s', [1], { id: 'd', epoch: 0, seq: 0 });
    await client.append('s', [1], { id: 'd', epoch: 0, seq: 0 });
    expect(srv.streams.get('s')).toEqual([1]);
    expect((await client.read('s')).items).toEqual([1]);
  });
});

async function vi_waitFor(cond: () => boolean, ms = 3000) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('timed out');
    await new Promise((r) => setTimeout(r, 20));
  }
}
