import { describe, expect, it } from 'vitest';
import { linkOf } from '@/lib/cloudflare-services';
import { validateSystem } from '@/lib/cloudflare-system';
import { looksLikeWorkerdConfig, parseCapnp, readWorkerdConfig } from '@/lib/cloudflare-workerd';

// The event-log pattern's config, as it is in replay-backend-patterns.
const EVENT_LOG = `using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "main", worker = .main),
    (name = "do-storage", disk = (path = "do-storage", writable = true)),
  ],
  sockets = [ (name = "http", address = "127.0.0.1:19610", http = (), service = "main") ],
);

const main :Workerd.Worker = (
  modules = [
    (name = "worker.js", esModule = embed "worker.js"),
    (name = "event-log.server", esModule = embed "event-log.js"),
    (name = "account.js", esModule = embed "account.js"),
    (name = "require-binding.server", esModule = embed "require-binding.server.js"),
  ],
  compatibilityDate = "2026-01-01",
  bindings = [ (name = "ACCOUNTS", durableObjectNamespace = "ProofAccount") ],
  durableObjectNamespaces = [ (className = "ProofAccount", uniqueKey = "event-log", enableSql = true) ],
  durableObjectStorage = (localDisk = "do-storage"),
);
`;

// The statechart spike's: a front Worker with an Order object, a stand-in queue and a consumer reaching back to Order.
const ORDERS = `using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "main", worker = .main),
    (name = "broker", worker = .broker),
    (name = "consumer", worker = .consumer),
    (name = "do-storage", disk = (path = "do-storage", writable = true)),
  ],
  sockets = [ (name = "http", address = "127.0.0.1:19810", http = (), service = "main") ],
);

const main :Workerd.Worker = (
  modules = [ (name = "worker.js", esModule = embed "worker.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [
    (name = "ORDERS", durableObjectNamespace = "Order"),
    (name = "QUEUE", queue = "broker"),
  ],
  durableObjectNamespaces = [ (className = "Order", uniqueKey = "statechart-order", enableSql = true) ],
  durableObjectStorage = (localDisk = "do-storage"),
);

# What stands in for Cloudflare's queues.
const broker :Workerd.Worker = (
  modules = [ (name = "broker.js", esModule = embed "broker.js") ],
  compatibilityDate = "2026-01-01",
  compatibilityFlags = ["service_binding_extra_handlers"],
  bindings = [ (name = "CONSUMER", service = "consumer") ],
);

const consumer :Workerd.Worker = (
  modules = [ (name = "consumer.js", esModule = embed "consumer.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [ (name = "ORDERS", durableObjectNamespace = (className = "Order", serviceName = "main")) ],
);
`;

const edgesOf = (source: string) => {
  const read = readWorkerdConfig(source);
  if (!read.ok) throw new Error(read.reason);
  return read.system.edges.map((e) => `${e.from} -${e.via}${e.binding ? `:${e.binding}` : ''}-> ${e.to}`);
};

describe('readWorkerdConfig', () => {
  it('reads the event-log config: a Worker, its class, the binding between them, and says what isn’t drawn', () => {
    const read = readWorkerdConfig(EVENT_LOG);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.system.services).toEqual([
      { id: 'main', kind: 'workers', label: 'main' },
      { id: 'main.ProofAccount', kind: 'durable-objects', label: 'ProofAccount' },
    ]);
    expect(edgesOf(EVENT_LOG)).toEqual(['main -durable_objects:ACCOUNTS-> main.ProofAccount']);
    expect(read.sockets).toEqual([{ name: 'http', address: '127.0.0.1:19610', service: 'main' }]);
    expect(read.notes.map((n) => n.code).sort()).toEqual(['not-a-service', 'socket', 'storage']);
    expect(read.notes.find((n) => n.code === 'storage')?.message).toContain('do-storage');
  });

  it('reads a system across Workers: a queue, a service binding, and a class bound from another Worker', () => {
    expect(edgesOf(ORDERS)).toEqual([
      'main -durable_objects:ORDERS-> main.Order',
      'main -queues:QUEUE-> queues:broker',
      'queues:broker -queue-consumer-> broker',
      'broker -services:CONSUMER-> consumer',
      'consumer -durable_objects:ORDERS-> main.Order',
    ]);
  });

  it('makes a system that the catalog agrees with, edge by edge', () => {
    for (const source of [EVENT_LOG, ORDERS]) {
      const read = readWorkerdConfig(source);
      if (!read.ok) throw new Error(read.reason);
      const kind = new Map(read.system.services.map((s) => [s.id, s.kind]));
      for (const e of read.system.edges) expect(linkOf(e, kind.get(e.from)!, kind.get(e.to)!), `${e.from} ${e.via} ${e.to}`).toMatchObject({ ok: true });
      expect(validateSystem(read.system).filter((i) => i.severity === 'error')).toEqual([]);
    }
  });

  it('draws KV, R2 and D1 by what answers for them, and says what it doesn’t draw', () => {
    const source = `const config :Workerd.Config = (services = [(name = "w", worker = .w), (name = "files", disk = (path = "x"))]);
const w :Workerd.Worker = (bindings = [
  (name = "CACHE", kvNamespace = "kv-store"),
  (name = "FILES", r2Bucket = "files"),
  (name = "DB", wrapped = (moduleName = "cloudflare-internal:d1-api", innerBindings = [])),
  (name = "GREETING", text = "hi"),
  (name = "ODD", somethingNew = "x"),
  (name = "GONE", service = "nowhere"),
]);`;
    const read = readWorkerdConfig(source);
    expect(read.ok).toBe(true);
    if (!read.ok) return;
    expect(read.system.services.map((s) => `${s.id}:${s.kind}`)).toEqual(['w:workers', 'kv:kv-store:kv', 'r2:files:r2', 'd1:DB:d1']);
    expect(edgesOf(source)).toEqual(['w -kv_namespaces:CACHE-> kv:kv-store', 'w -r2_buckets:FILES-> r2:files', 'w -d1_databases:DB-> d1:DB']);
    expect(read.notes.map((n) => n.message)).toEqual(expect.arrayContaining([
      expect.stringContaining('GREETING is a text value'),
      expect.stringContaining('ODD is a somethingNew binding'),
      expect.stringContaining('GONE reaches nowhere, which isn’t in this config'),
    ]));
  });

  it('refuses what isn’t a config, saying where', () => {
    expect(readWorkerdConfig('struct Foo { a @0 :Text; }')).toMatchObject({ ok: false, reason: expect.stringContaining('line 1') });
    expect(readWorkerdConfig('const x :Text = "hi";')).toMatchObject({ ok: false, reason: expect.stringContaining('no workerd config') });
    expect(readWorkerdConfig('const config :Workerd.Config = (services = [ (name = "a" ]);')).toMatchObject({ ok: false, reason: expect.stringContaining('line 1') });
    expect(readWorkerdConfig('const config :Workerd.Config = (services = "unclosed);')).toMatchObject({ ok: false, reason: expect.stringContaining('isn\'t closed') });
  });

  it('reads the format: comments, refs, embeds, adjacent strings, numbers, enums and a file id', () => {
    const consts = parseCapnp(`@0xabcdef0123456789;
# a comment
const a :Foo = (x = -1.5, y = .b, z = embed "f.js", s = "a" "b", e = http, l = [1, 2,], t = true);
const b :Bar = ();`);
    expect(consts.map((c) => `${c.name}:${c.type}`)).toEqual(['a:Foo', 'b:Bar']);
    const a = consts[0]!.value;
    if (a.kind !== 'struct') throw new Error('a struct');
    expect(Object.fromEntries(a.fields)).toEqual({
      x: { kind: 'number', value: -1.5 }, y: { kind: 'ref', name: 'b' }, z: { kind: 'embed', path: 'f.js' }, s: { kind: 'string', value: 'ab' },
      e: { kind: 'name', name: 'http' }, l: { kind: 'list', items: [{ kind: 'number', value: 1 }, { kind: 'number', value: 2 }] }, t: { kind: 'bool', value: true },
    });
  });

  it('tells a config from other Cap’n Proto without reading it', () => {
    expect(looksLikeWorkerdConfig(EVENT_LOG)).toBe(true);
    expect(looksLikeWorkerdConfig('struct Foo { a @0 :Text; }')).toBe(false);
  });
});

describe('placeInLayers', () => {
  it('puts what nothing reaches first, then what it reaches, and keeps a place that was given', async () => {
    const { placeInLayers } = await import('@/lib/cloudflare-system');
    const read = readWorkerdConfig(ORDERS);
    if (!read.ok) throw new Error(read.reason);
    const placed = placeInLayers(read.system);
    const at = Object.fromEntries(placed.services.map((s) => [s.id, s.at]));
    // main reaches the queue and Order; the queue reaches broker, broker reaches consumer, consumer reaches Order.
    const column = (id: string) => at[id]!.x;
    expect(column('main')).toBe(0);
    expect(column('queues:broker')).toBeGreaterThan(column('main'));
    expect(column('broker')).toBeGreaterThan(column('queues:broker'));
    expect(column('consumer')).toBeGreaterThan(column('broker'));
    expect(column('main.Order')).toBeGreaterThan(column('consumer'));
    // Nothing on top of anything in a column.
    const byColumn = new Map<number, { y: number; id: string }[]>();
    for (const s of placed.services) byColumn.set(s.at!.x, [...(byColumn.get(s.at!.x) ?? []), { y: s.at!.y, id: s.id }]);
    for (const list of byColumn.values()) expect(new Set(list.map((p) => p.y)).size).toBe(list.length);
    const kept = placeInLayers({ ...read.system, services: read.system.services.map((s) => (s.id === 'main' ? { ...s, at: { x: 5, y: 7 } } : s)) });
    expect(kept.services.find((s) => s.id === 'main')!.at).toEqual({ x: 5, y: 7 });
    // A circle doesn't stop it.
    const circle = placeInLayers({ services: [{ id: 'a', kind: 'workers' }, { id: 'b', kind: 'workers' }], edges: [{ id: '1', from: 'a', to: 'b', via: 'services' }, { id: '2', from: 'b', to: 'a', via: 'services' }] });
    expect(circle.services.every((s) => s.at)).toBe(true);
  });
});
