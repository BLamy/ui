import { parseTree } from 'jsonc-parser';
import { describe, expect, it } from 'vitest';
import { CLOUDFLARE_CATALOG as C } from './cloudflare-catalog.generated';
import { catalogBinding, type CloudflareEdge, type CloudflareService } from './cloudflare-services';
import { checkMachines, parseSystem, systemToJson, validateSystem, type CloudflareSystem } from './cloudflare-system';
import { WRANGLER_RESOURCE_FIELDS, compareWrangler, readWrangler, writeWrangler, type WranglerRead } from './cloudflare-wrangler';

/* Real configs, word for word, from replay-recording-inspector. */
const TANSTACK_START = `// Read by @cloudflare/vite-plugin to build the worker. Nothing is deployed: replay-run serves the build with
// plain workerd.
{
  "name": "tasks-tanstack-start",
  "main": "@tanstack/react-start/server-entry",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat"]
}
`;
/** The do-shop's: \`demos/tanstack-start-pair/app/wrangler.jsonc\`, after what its record.sh does to it. */
const DO_SHOP_BASE = `// Read by @cloudflare/vite-plugin to build the worker. Nothing here is deployed: the
// demo serves the build with plain workerd, from a config written by ../tools/site.js.
{
  "name": "tanstack-start-pair",
  "main": "src/server.ts",
  "compatibility_date": "2026-10-01"
}
`;
const DO_SHOP = DO_SHOP_BASE.replace('"compatibility_date": "2026-10-01"', '"compatibility_date": "2026-10-01",\n  "durable_objects": { "bindings": [{ "name": "SHOP", "class_name": "Shop" }] },\n  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Shop"] }]');
const STORAGE = `{
  "name": "storage",
  "main": "src/index.ts",
  "compatibility_date": "2026-01-01",
  "kv_namespaces": [{ "binding": "KV", "id": "local-kv" }],
  "r2_buckets": [{ "binding": "BUCKET", "bucket_name": "local-bucket" }],
  "d1_databases": [{ "binding": "DB", "database_name": "local-db", "database_id": "11111111-1111-1111-1111-111111111111" }],
  "durable_objects": { "bindings": [{ "name": "COUNTER", "class_name": "Counter" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Counter"] }]
}
`;
const QUEUES = `{
  "name": "queues",
  "main": "src/index.ts",
  "compatibility_date": "2026-01-01",
  "queues": {
    "producers": [{ "binding": "ORDERS", "queue": "orders" }],
    "consumers": [{ "queue": "orders", "max_batch_size": 2, "max_batch_timeout": 1 }]
  }
}
`;
const SERVICES = `{
  "name": "services",
  "main": "src/index.ts",
  "compatibility_date": "2026-01-01",
  "vars": { "GREETING": "a var from the config" },
  "ratelimits": [{ "name": "LIMITER", "namespace_id": "1001", "simple": { "limit": 1, "period": 60 } }],
  "send_email": [{ "name": "EMAIL", "destination_address": "ada@example.test" }],
  "analytics_engine_datasets": [{ "binding": "EVENTS", "dataset": "events" }],
  "version_metadata": { "binding": "VERSION" },
  "worker_loaders": [{ "binding": "LOADER" }],
  "secrets_store_secrets": [{ "binding": "SECRET", "store_id": "store-1", "secret_name": "api-key" }]
}
`;
const NEXTJS = `// Read by OpenNext and wrangler to build the worker. Nothing is deployed: replay-run serves the
// build with plain workerd.
{
  "name": "tasks-nextjs",
  "main": ".open-next/worker.js",
  "compatibility_date": "2026-10-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  // esbuild's __name() helper breaks anything that turns a function into text.
  "keep_names": false,
  "assets": { "directory": ".open-next/assets", "binding": "ASSETS" }
}
`;
const MORE = `{
  "name": "more",
  "main": "src/index.ts",
  "compatibility_date": "2026-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "send_email": [{ "name": "EMAIL", "destination_address": "ada@example.test" }],
  "pipelines": [{ "binding": "PIPELINE", "stream": "events" }],
  "images": { "binding": "IMAGES" },
  "unsafe_hello_world": [{ "binding": "HELLO", "enable_timer": false }],
  "flagship": [{ "binding": "FLAGS", "app_id": "app" }]
}
`;
const REAL: Record<string, string> = { TANSTACK_START, DO_SHOP, STORAGE, QUEUES, SERVICES, NEXTJS, MORE };

/** A hand-kept config, with comments everywhere that one can have them. */
const COMMENTED = `// The API's Worker.
/* It's kept by hand, so its comments matter. */
{
  "name": "api", // what it's deployed as
  "main": "src/index.ts",

  // Storage
  "r2_buckets": [
    // Where uploads go.
    { "binding": "FILES", "bucket_name": "uploads" }, // the big one
    /* Thumbnails, which can be made again. */
    {
      "binding": "THUMBS",
      // Not preview: this one's real.
      "bucket_name": "thumbs",
      "jurisdiction": "eu"
    } // end of thumbs
  ],
  "kv_namespaces": [{ "binding": "SESSIONS", "id": "abc123" }], // one line, and a comment
  "durable_objects": {
    // Each room's one of these.
    "bindings": [{ "name": "ROOM", "class_name": "Room" }]
  },
  "ai": { "binding": "AI" }, // for summaries
  "vars": {
    "GREETING": "hello // not a comment" // this is
  }
  // That's all, for now.
}
// The end.
`;

const read = (text: string, env?: string) => {
  const r = readWrangler(text, env === undefined ? {} : { env });
  if (!r.ok) throw new Error(r.reason);
  return r;
};
const write = (text: string, system: CloudflareSystem, options = {}) => {
  const w = writeWrangler(text, system, options);
  if (!w.ok) throw new Error(w.reason);
  return w;
};
const asKeys = (r: Extract<WranglerRead, { ok: true }>) => r.system.edges.map((e) => `${e.from}>${e.to}:${e.via}:${e.binding ?? ''}`);
const parses = (text: string) => {
  const errors: unknown[] = [];
  parseTree(text.replace(/^﻿/, ''), errors as never, { allowTrailingComma: true });
  return errors;
};
/** Every comment in a text, as what's written: outside strings. */
const commentsIn = (text: string) => {
  const found: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '"') { for (i++; text[i] !== '"'; i++) if (text[i] === '\\') i++; continue; }
    if (text.startsWith('//', i)) { const end = text.slice(i).search(/\r?\n|$/) + i; found.push(text.slice(i, end)); i = end; } else if (text.startsWith('/*', i)) { const end = text.indexOf('*/', i) + 2; found.push(text.slice(i, end)); i = end; }
  }
  return found;
};
const withEdges = (s: CloudflareSystem, edges: readonly CloudflareEdge[], services: readonly CloudflareService[] = s.services): CloudflareSystem => ({ services, edges });

describe('reading real configs', () => {
  it('reads the tanstack-start starter: a Worker, with nothing bound to it', () => {
    const r = read(TANSTACK_START);
    expect(r.worker).toBe('tasks-tanstack-start');
    expect(r.system).toEqual({ services: [{ id: 'tasks-tanstack-start', kind: 'workers', label: 'tasks-tanstack-start' }], edges: [] });
    expect(r.notes).toEqual([]);
  });

  it('reads the do-shop’s: its Durable Object, by its class', () => {
    const r = read(DO_SHOP);
    expect(r.system.services).toEqual([
      { id: 'tanstack-start-pair', kind: 'workers', label: 'tanstack-start-pair' },
      { id: 'durable-objects:Shop', kind: 'durable-objects', label: 'Shop', resource: 'Shop' },
    ]);
    expect(r.system.edges).toEqual([{ id: 'tanstack-start-pair-durable_objects-SHOP', from: 'tanstack-start-pair', to: 'durable-objects:Shop', via: 'durable_objects', binding: 'SHOP' }]);
    expect(validateSystem(r.system)).toEqual([]);
  });

  it('reads storage, each to what’s behind it', () => {
    expect(asKeys(read(STORAGE))).toEqual([
      'storage>durable-objects:Counter:durable_objects:COUNTER',
      'storage>kv:local-kv:kv_namespaces:KV',
      'storage>r2:local-bucket:r2_buckets:BUCKET',
      'storage>d1:local-db:d1_databases:DB',
    ]);
  });

  it('reads a queue, with a producer and a consumer of it as one service', () => {
    const r = read(QUEUES);
    expect(asKeys(r)).toEqual(['queues>queues:orders:queues:ORDERS', 'queues:orders>queues:queue-consumer:']);
    expect(r.system.services.map((s) => s.id)).toEqual(['queues', 'queues:orders']);
    expect(validateSystem(r.system)).toEqual([]);
  });

  it('says what’s on env that isn’t a way to anything, by name, and doesn’t draw it', () => {
    const r = read(SERVICES);
    expect(r.settings).toEqual(expect.arrayContaining([{ key: 'version_metadata', name: 'VERSION' }, { key: 'ratelimits', name: 'LIMITER' }, { key: 'vars', name: 'GREETING' }]));
    expect(asKeys(r).map((k) => k.split(':').pop())).toEqual(['EMAIL', 'EVENTS', 'SECRET', 'LOADER']);
    expect(read(NEXTJS).settings).toEqual([{ key: 'assets', name: 'ASSETS' }]);
    expect(read(NEXTJS).system.edges).toEqual([]);
  });

  it('has a real connection for everything in every one of them', () => {
    for (const [name, text] of Object.entries(REAL)) {
      const problems = validateSystem(read(text).system).filter((i) => i.severity === 'error');
      expect(problems, name).toEqual([]);
    }
  });

  it('knows Pages from a Worker', () => {
    expect(read('{ "name": "site", "pages_build_output_dir": "dist" }').system.services[0]!.kind).toBe('pages');
  });

  it('copes with no name at all', () => {
    const r = read('{ "kv_namespaces": [{ "binding": "KV" }] }');
    expect(r.system.services[0]).toEqual({ id: 'worker', kind: 'workers' });
    expect(asKeys(r)).toEqual(['worker>kv:KV:kv_namespaces:KV']);
  });

  it('makes one service of what two bindings point at, and a Worker bound to itself is one service', () => {
    const r = read('{ "name": "w", "r2_buckets": [{ "binding": "A", "bucket_name": "b" }, { "binding": "RO", "bucket_name": "b" }], "services": [{ "binding": "SELF", "service": "w" }, { "binding": "OTHER", "service": "x" }] }');
    expect(r.system.services.map((s) => s.id)).toEqual(['w', 'r2:b', 'workers:x']);
    expect(asKeys(r)).toEqual(['w>r2:b:r2_buckets:A', 'w>r2:b:r2_buckets:RO', 'w>w:services:SELF', 'w>workers:x:services:OTHER']);
    expect(validateSystem(r.system)).toEqual([]);
  });
});

describe('going round', () => {
  it('leaves every real config exactly as it was, with nothing changed', () => {
    for (const [name, text] of Object.entries({ ...REAL, COMMENTED })) {
      const system = read(text).system;
      const w = write(text, system);
      expect(w.differences, name).toEqual([]);
      expect(w.text, name).toBe(text);
      expect(compareWrangler(text, system), name).toMatchObject({ ok: true, differences: [] });
    }
  });

  it('survives being saved as JSON on the way', () => {
    for (const text of Object.values(REAL)) {
      const { system } = parseSystem(systemToJson(read(text).system));
      expect(write(text, system).text).toBe(text);
    }
  });
});

describe('writing back', () => {
  const start = read(COMMENTED).system;
  const edge = (name: string) => start.edges.find((e) => e.binding === name)!;

  it('renames only the name', () => {
    const next = withEdges(start, start.edges.map((e) => (e.binding === 'FILES' ? { ...e, binding: 'UPLOADS' } : e)));
    const w = write(COMMENTED, next);
    expect(w.differences).toEqual([expect.objectContaining({ kind: 'renamed', key: 'r2_buckets', name: 'UPLOADS', was: 'FILES', message: 'FILES, in the config, is called UPLOADS in the system.' })]);
    expect(w.text).toBe(COMMENTED.replace('"binding": "FILES"', '"binding": "UPLOADS"'));
  });

  it('points something at another resource, and only that', () => {
    const next = { ...start, services: start.services.map((s) => (s.id === edge('FILES').to ? { ...s, resource: 'elsewhere' } : s)) };
    const w = write(COMMENTED, next);
    expect(w.differences).toEqual([expect.objectContaining({ kind: 'resource', name: 'FILES', was: 'uploads', now: 'elsewhere' })]);
    expect(w.text).toBe(COMMENTED.replace('"bucket_name": "uploads"', '"bucket_name": "elsewhere"'));
  });

  it('a label’s only what it’s called on a diagram', () => {
    const next = { ...start, services: start.services.map((s) => (s.id === edge('FILES').to ? { ...s, label: 'Everything anyone uploads' } : s)) };
    expect(write(COMMENTED, next).text).toBe(COMMENTED);
  });

  it('takes one out of the middle of a list, and leaves the comments', () => {
    const w = write(COMMENTED, withEdges(start, start.edges.filter((e) => e.binding !== 'FILES')));
    expect(w.differences).toEqual([expect.objectContaining({ kind: 'removed', key: 'r2_buckets', name: 'FILES', message: 'FILES (R2 Bucket) is in the config, and not in the system.' })]);
    expect(w.text).toBe(COMMENTED.replace('{ "binding": "FILES", "bucket_name": "uploads" }, // the big one', '// the big one'));
    expect(parses(w.text)).toEqual([]);
    expect(commentsIn(w.text)).toEqual(commentsIn(COMMENTED));
  });

  it('takes the last one out of a list, and its comma', () => {
    const w = write(COMMENTED, withEdges(start, start.edges.filter((e) => e.binding !== 'THUMBS')));
    expect(parses(w.text)).toEqual([]);
    expect(w.text).toContain('{ "binding": "FILES", "bucket_name": "uploads" } // the big one');
    expect(w.text).not.toContain('thumbs"');
    // What was inside it goes with it, and everything outside it stays.
    expect(commentsIn(w.text)).toEqual(commentsIn(COMMENTED).filter((c) => c !== '// Not preview: this one\'s real.'));
  });

  it('takes the only one out of a list, and leaves the list', () => {
    const w = write(COMMENTED, withEdges(start, start.edges.filter((e) => e.binding !== 'SESSIONS')));
    expect(w.text).toContain('"kv_namespaces": [], // one line, and a comment');
    expect(parses(w.text)).toEqual([]);
  });

  it('takes one that’s a key of its own out, with its comma, and leaves its comment', () => {
    const w = write(COMMENTED, withEdges(start, start.edges.filter((e) => e.binding !== 'AI')));
    expect(w.differences).toEqual([expect.objectContaining({ kind: 'removed', key: 'ai', name: 'AI' })]);
    expect(w.text).toBe(COMMENTED.replace('"ai": { "binding": "AI" }, // for summaries', '// for summaries'));
    expect(parses(w.text)).toEqual([]);
  });

  it('adds to a list on many lines, after the last one’s comment', () => {
    const service = { id: 'r2:more', kind: 'r2', label: 'More', resource: 'more' };
    const next = withEdges(start, [...start.edges, { id: 'new', from: start.services[0]!.id, to: service.id, via: 'r2_buckets', binding: 'MORE' }], [...start.services, service]);
    const w = write(COMMENTED, next);
    expect(w.differences).toEqual([expect.objectContaining({ kind: 'added', key: 'r2_buckets', name: 'MORE', now: 'more', message: 'MORE (R2 Bucket) is in the system, and not in the config.' })]);
    expect(w.text).toBe(COMMENTED.replace(`    } // end of thumbs\n`, `    }, // end of thumbs\n    { "binding": "MORE", "bucket_name": "more" }\n`));
    expect(parses(w.text)).toEqual([]);
  });

  it('adds to a list on one line, staying on it', () => {
    const service = { id: 'kv:two', kind: 'kv', resource: 'two' };
    const w = write(COMMENTED, withEdges(start, [...start.edges, { id: 'new', from: start.services[0]!.id, to: service.id, via: 'kv_namespaces', binding: 'TWO' }], [...start.services, service]));
    expect(w.text).toBe(COMMENTED.replace('{ "binding": "SESSIONS", "id": "abc123" }]', '{ "binding": "SESSIONS", "id": "abc123" }, { "binding": "TWO", "id": "two" }]'));
  });

  it('adds what isn’t there yet at the end, ahead of the last comment', () => {
    const service = { id: 'd1:db', kind: 'd1', label: 'db' };
    const w = write(COMMENTED, withEdges(start, [...start.edges, { id: 'new', from: start.services[0]!.id, to: service.id, via: 'd1_databases', binding: 'DB' }], [...start.services, service]));
    expect(w.text).toBe(COMMENTED.replace(`this is\n  }\n`, `this is\n  },\n  "d1_databases": [{ "binding": "DB", "database_name": "db" }]\n`));
    expect(parses(w.text)).toEqual([]);
    expect(commentsIn(w.text)).toEqual(commentsIn(COMMENTED));
  });

  it('adds one that’s a key of its own, and one that’s in a list under another key', () => {
    const browser = { id: 'browser-run', kind: 'browser-run' };
    const q = { id: 'queues:orders', kind: 'queues', label: 'orders' };
    const worker = start.services[0]!.id;
    const w = write(TANSTACK_START, { services: [{ id: 'tasks-tanstack-start', kind: 'workers', label: 'tasks-tanstack-start' }, browser, q], edges: [{ id: 'a', from: 'tasks-tanstack-start', to: browser.id, via: 'browser', binding: 'BROWSER' }, { id: 'b', from: 'tasks-tanstack-start', to: q.id, via: 'queues', binding: 'ORDERS' }, { id: 'c', from: q.id, to: 'tasks-tanstack-start', via: 'queue-consumer' }] });
    expect(worker).toBe('api');
    expect(w.text).toBe(TANSTACK_START.replace(`"compatibility_flags": ["nodejs_compat"]\n`, `"compatibility_flags": ["nodejs_compat"],\n  "browser": { "binding": "BROWSER" },\n  "queues": { "producers": [{ "binding": "ORDERS", "queue": "orders" }], "consumers": [{ "queue": "orders" }] }\n`));
    expect(read(w.text).system.edges.map((e) => e.via)).toEqual(['queues', 'browser', 'queue-consumer']);
  });

  it('adds a consumer to what’s there, and takes one out, by its queue', () => {
    const r = read(QUEUES);
    const gone = write(QUEUES, withEdges(r.system, r.system.edges.filter((e) => e.via !== 'queue-consumer')));
    expect(gone.differences).toEqual([expect.objectContaining({ kind: 'removed', key: 'queues.consumers', name: 'orders', message: 'The consumer of orders is in the config, and not in the system.' })]);
    expect(gone.text).toBe(QUEUES.replace('{ "queue": "orders", "max_batch_size": 2, "max_batch_timeout": 1 }', ''));
    const back = write(gone.text, r.system);
    expect(back.differences).toEqual([expect.objectContaining({ kind: 'added', key: 'queues.consumers', name: 'orders', message: 'The consumer of orders is in the system, and not in the config.' })]);
    expect(back.text).toBe(QUEUES.replace('{ "queue": "orders", "max_batch_size": 2, "max_batch_timeout": 1 }', '{ "queue": "orders" }'));
  });

  it('says what a new binding has to have that a system doesn’t say', () => {
    const v = { id: 'vectorize', kind: 'vectorize' };
    const worker = start.services[0]!.id;
    const w = write(COMMENTED, withEdges(start, [...start.edges, { id: 'new', from: worker, to: 'vectorize', via: 'vectorize', binding: 'INDEX' }], [...start.services, v]));
    expect(w.needs).toEqual([expect.objectContaining({ key: 'vectorize', name: 'INDEX', fields: ['index_name'], message: expect.stringContaining('`index_name`') })]);
    const room = { id: 'do', kind: 'durable-objects', label: 'Lobby', resource: 'Lobby' };
    const d = write(COMMENTED, withEdges(start, [...start.edges, { id: 'new', from: worker, to: 'do', via: 'durable_objects', binding: 'LOBBY' }], [...start.services, room]));
    expect(d.text).toContain('[{ "name": "ROOM", "class_name": "Room" }, { "name": "LOBBY", "class_name": "Lobby" }]');
    expect(d.needs).toEqual([expect.objectContaining({ fields: ['migrations'] })]);
  });

  it('goes by what a service is bound as, on an edge with no name', () => {
    const r = read(STORAGE);
    const next = { services: r.system.services.map((s) => (s.kind === 'kv' ? { ...s, binding: 'KV' } : s)), edges: r.system.edges.map((e) => (e.via === 'kv_namespaces' ? { ...e, binding: undefined } : e)) };
    expect(write(STORAGE, next).text).toBe(STORAGE);
  });

  it('writes only a real connection, and says which it left out', () => {
    const r = read(STORAGE);
    const worker = r.worker;
    const w = write(STORAGE, withEdges(r.system, [...r.system.edges, { id: 'not-real', from: worker, to: 'd1:local-db', via: 'r2_buckets', binding: 'WRONG' }, { id: 'ghost', from: worker, to: 'nowhere', via: 'r2_buckets', binding: 'GHOST' }, { id: 'unnamed', from: worker, to: 'r2:local-bucket', via: 'r2_buckets' }]));
    expect(w.text).toBe(STORAGE);
    expect(w.skipped.map((s) => s.edge)).toEqual(['not-real', 'ghost', 'unnamed']);
    expect(w.skipped[0]!.reason).toContain('can’t be reached that way');
    expect(w.skipped[1]!.reason).toContain('isn’t in this system');
  });

  it('ignores what a config doesn’t hold, like a machine or where things are on the board', () => {
    const r = read(STORAGE);
    const next = { services: r.system.services.map((s, i) => ({ ...s, at: { x: i, y: i }, machine: { initial: 'a', states: { a: {} } } })), edges: r.system.edges.map((e) => ({ ...e, operations: ['get'], events: ['X'] })) };
    expect(write(STORAGE, next).text).toBe(STORAGE);
  });

  it('writes the bindings of one Worker, and says if it can’t tell which', () => {
    const two: CloudflareSystem = { services: [{ id: 'a', kind: 'workers' }, { id: 'b', kind: 'workers' }, { id: 'kv', kind: 'kv' }], edges: [{ id: 'x', from: 'a', to: 'kv', via: 'kv_namespaces', binding: 'A_KV' }, { id: 'y', from: 'b', to: 'kv', via: 'kv_namespaces', binding: 'B_KV' }] };
    const asked = writeWrangler('{ "name": "z" }', two);
    expect(asked).toEqual({ ok: false, reason: expect.stringContaining('Say which') });
    expect(write('{ "name": "z" }', two, { worker: 'b' }).text).toBe('{ "name": "z", "kv_namespaces": [{ "binding": "B_KV" }] }');
    expect(write('{ "name": "a" }', two).text).toContain('A_KV');
    expect(writeWrangler('{ "name": "z" }', two, { worker: 'nope' })).toEqual({ ok: false, reason: 'There’s no service called nope in this system.' });
    expect(writeWrangler('{ "name": "z" }', { services: [{ id: 'r', kind: 'r2' }], edges: [] })).toEqual({ ok: false, reason: expect.stringContaining('Nothing in this system runs code') });
  });
});

describe('the file as it’s laid out', () => {
  const add = (text: string) => {
    const r = read(text);
    const s = { id: 'kv:n', kind: 'kv', resource: 'n' };
    return write(text, withEdges(r.system, [...r.system.edges, { id: 'n', from: r.worker, to: s.id, via: 'kv_namespaces', binding: 'N' }], [...r.system.services, s])).text;
  };

  it('keeps Windows line endings', () => {
    const text = STORAGE.replace(/\n/g, '\r\n');
    expect(write(text, read(text).system).text).toBe(text);
    const r = read(text);
    const out = write(text, withEdges(r.system, r.system.edges.filter((e) => e.binding !== 'KV'))).text;
    expect(out).not.toMatch(/[^\r]\n/);
    const multi = '{\r\n  "name": "w",\r\n  "kv_namespaces": [\r\n    { "binding": "A" }\r\n  ]\r\n}\r\n';
    expect(add(multi)).toBe('{\r\n  "name": "w",\r\n  "kv_namespaces": [\r\n    { "binding": "A" },\r\n    { "binding": "N", "id": "n" }\r\n  ]\r\n}\r\n');
  });

  it('keeps tabs', () => {
    expect(add('{\n\t"name": "w",\n\t"main": "x"\n}\n')).toBe('{\n\t"name": "w",\n\t"main": "x",\n\t"kv_namespaces": [{ "binding": "N", "id": "n" }]\n}\n');
  });

  it('keeps a byte-order mark', () => {
    const text = `﻿${DO_SHOP}`;
    expect(read(text).worker).toBe('tanstack-start-pair');
    expect(write(text, read(text).system).text).toBe(text);
    expect(add(text).startsWith('\uFEFF// Read by')).toBe(true);
  });

  it('keeps trailing commas', () => {
    const text = '{\n  "name": "w",\n  "kv_namespaces": [\n    { "binding": "A" },\n  ],\n}\n';
    expect(write(text, read(text).system).text).toBe(text);
    expect(add(text)).toBe('{\n  "name": "w",\n  "kv_namespaces": [\n    { "binding": "A" },\n    { "binding": "N", "id": "n" },\n  ],\n}\n');
    const r = read(text);
    expect(write(text, withEdges(r.system, [])).text).toBe('{\n  "name": "w",\n  "kv_namespaces": [\n  ],\n}\n');
    expect(parses(write(text, withEdges(r.system, [])).text)).toEqual([]);
  });

  it('copes with an empty list, one with only a comment in it, and a file that’s nearly empty', () => {
    expect(add('{ "name": "w", "kv_namespaces": [] }')).toBe('{ "name": "w", "kv_namespaces": [{ "binding": "N", "id": "n" }] }');
    expect(add('{\n  "kv_namespaces": [\n    // none yet\n  ]\n}')).toBe('{\n  "kv_namespaces": [\n    // none yet\n    { "binding": "N", "id": "n" }\n  ]\n}');
    expect(add('{}')).toBe('{ "kv_namespaces": [{ "binding": "N", "id": "n" }] }');
    expect(add('{ /* nothing */ }')).toBe('{ /* nothing */ "kv_namespaces": [{ "binding": "N", "id": "n" }] }');
    for (const text of ['{ "name": "w", "kv_namespaces": [] }', '{\n  "kv_namespaces": [\n    // none yet\n  ]\n}', '{}', '{ /* nothing */ }']) expect(parses(add(text)), text).toEqual([]);
  });

  it('isn’t fooled by what looks like a comment or a key in a string', () => {
    const text = '{ "name": "http://x/*y*/", "vars": { "r2_buckets": "[]" }, "kv_namespaces": [{ "binding": "A", "id": "// not a comment" }] }';
    const r = read(text);
    expect(asKeys(r)).toEqual(['http://x/*y*/>kv:// not a comment:kv_namespaces:A']);
    expect(write(text, r.system).text).toBe(text);
    expect(add(text)).toBe(text.replace(' }] }', ' }, { "binding": "N", "id": "n" }] }'));
  });

  it('goes by the last of a key that’s there twice, as JSON does', () => {
    const r = read('{ "kv_namespaces": [{ "binding": "OLD" }], "kv_namespaces": [{ "binding": "NEW" }] }');
    expect(asKeys(r)).toEqual(['worker>kv:NEW:kv_namespaces:NEW']);
  });
});

describe('env sections', () => {
  const ENVS = `{
  "name": "shop",
  "kv_namespaces": [{ "binding": "CACHE", "id": "prod" }],
  "env": {
    // Staging has its own of everything.
    "staging": {
      "kv_namespaces": [{ "binding": "CACHE", "id": "stage" }],
      "r2_buckets": [{ "binding": "FILES", "bucket_name": "stage-files" }]
    },
    "dev": { "name": "shop-local" },
    "broken": 3
  }
}
`;

  it('reads the top level, and says what it didn’t read', () => {
    const r = read(ENVS);
    expect(r.envs).toEqual(['staging', 'dev', 'broken']);
    expect(asKeys(r)).toEqual(['shop>kv:prod:kv_namespaces:CACHE']);
    expect(r.notes).toEqual([expect.objectContaining({ code: 'env-not-read', message: expect.stringContaining('staging, dev, broken') })]);
  });

  it('reads one by name, with what’s in it and nothing else, as bindings aren’t inherited', () => {
    const r = read(ENVS, 'staging');
    expect(r.worker).toBe('shop-staging');
    expect(asKeys(r)).toEqual(['shop-staging>kv:stage:kv_namespaces:CACHE', 'shop-staging>r2:stage-files:r2_buckets:FILES']);
    expect(r.notes).toEqual([]);
    expect(read(ENVS, 'dev').worker).toBe('shop-local');
    expect(read(ENVS, 'dev').system.edges).toEqual([]);
  });

  it('says so if there’s no such env, and what there is', () => {
    expect(readWrangler(ENVS, { env: 'nope' })).toEqual({ ok: false, kind: 'env', reason: 'There’s no env called nope. It has staging, dev, broken.' });
    expect(readWrangler(ENVS, { env: 'broken' })).toMatchObject({ ok: false, kind: 'shape' });
    expect(readWrangler(DO_SHOP, { env: 'nope' })).toEqual({ ok: false, kind: 'env', reason: 'There’s no env called nope, as it has no env sections.' });
    expect(writeWrangler(ENVS, { services: [{ id: 'w', kind: 'workers' }], edges: [] }, { env: 'nope' })).toMatchObject({ ok: false, reason: expect.stringContaining('no env called nope') });
  });

  it('writes to that env, and leaves the top level and the others as they were', () => {
    const r = read(ENVS, 'staging');
    expect(write(ENVS, r.system, { env: 'staging' }).text).toBe(ENVS);
    const w = write(ENVS, withEdges(r.system, r.system.edges.map((e) => (e.binding === 'FILES' ? { ...e, binding: 'UPLOADS' } : e))), { env: 'staging' });
    expect(w.text).toBe(ENVS.replace('"binding": "FILES"', '"binding": "UPLOADS"'));
    const dropped = write(ENVS, withEdges(r.system, r.system.edges.filter((e) => e.binding !== 'CACHE')), { env: 'staging' });
    expect(dropped.text).toBe(ENVS.replace('[{ "binding": "CACHE", "id": "stage" }]', '[]'));
    expect(read(dropped.text).system.edges.map((e) => e.binding)).toEqual(['CACHE']);
    // A key it doesn't have yet goes in that section.
    const devRead = read(ENVS, 'dev');
    const s = { id: 'kv:d', kind: 'kv', resource: 'd' };
    const added = write(ENVS, withEdges(devRead.system, [{ id: 'n', from: devRead.worker, to: s.id, via: 'kv_namespaces', binding: 'DEV' }], [...devRead.system.services, s]), { env: 'dev' });
    expect(added.text).toBe(ENVS.replace('"dev": { "name": "shop-local" }', '"dev": { "name": "shop-local", "kv_namespaces": [{ "binding": "DEV", "id": "d" }] }'));
  });

  it('compares against that env', () => {
    const top = read(ENVS).system;
    const c = compareWrangler(ENVS, { ...top, services: top.services.map((s) => (s.id === 'shop' ? { ...s, id: 'shop-staging', label: 'shop-staging' } : s)), edges: top.edges.map((e) => ({ ...e, from: 'shop-staging' })) }, { env: 'staging' });
    expect(c.ok && c.differences.map((d) => `${d.kind}:${d.name}`).sort()).toEqual(['removed:FILES', 'resource:CACHE']);
  });
});

describe('a binding the catalog doesn’t know', () => {
  const FUTURE = `{
  "name": "w",
  "new_thing": [{ "binding": "NEW", "region": "mars" }],
  "other_new": { "binding": "OTHER" },
  // This one looks like nothing.
  "plain_setting": { "enabled": true },
  "r2_buckets": [{ "binding": "OK" }]
}
`;

  it('says so by name, and doesn’t guess at what it is', () => {
    const r = read(FUTURE);
    expect(r.notes.map((n) => `${n.code}:${n.key}:${n.name}`)).toEqual(['unknown-binding:new_thing:NEW', 'unknown-binding:other_new:OTHER']);
    expect(r.notes[0]!.message).toContain(`isn’t in the catalog, as of ${C.pins.docs.date}`);
    expect(asKeys(r)).toEqual(['w>r2:OK:r2_buckets:OK']);
  });

  it('leaves it in the file, whatever else changes', () => {
    const r = read(FUTURE);
    expect(write(FUTURE, r.system).text).toBe(FUTURE);
    const w = write(FUTURE, withEdges(r.system, []));
    expect(w.text).toContain('"new_thing": [{ "binding": "NEW", "region": "mars" }]');
    expect(w.text).toContain('"r2_buckets": []');
    expect(w.differences.map((d) => d.name)).toEqual(['OK']);
    const c = compareWrangler(FUTURE, r.system);
    expect(c.ok && c.notes.map((n) => n.name)).toEqual(['NEW', 'OTHER']);
  });

  it('says what’s wrong with what the catalog does know, and doesn’t draw it', () => {
    const r = read('{ "r2_buckets": [{ "bucket_name": "no-name" }, 3, { "binding": "OK" }], "kv_namespaces": { "binding": "NOT_A_LIST" }, "browser": [] }');
    expect(r.notes.map((n) => n.code)).toEqual(expect.arrayContaining(['no-name', 'wrong-shape', 'wrong-shape', 'wrong-shape']));
    expect(r.notes.map((n) => n.message)).toEqual(expect.arrayContaining([expect.stringContaining('`r2_buckets`, item 1, has no `binding`'), expect.stringContaining('`kv_namespaces` has to be a list'), expect.stringContaining('`browser` has to be an object')]));
    expect(asKeys(r)).toEqual(['worker>r2:OK:r2_buckets:OK']);
  });

  it('says so if a name’s used twice', () => {
    const r = read('{ "kv_namespaces": [{ "binding": "A", "id": "1" }, { "binding": "A", "id": "2" }] }');
    expect(r.notes.map((n) => `${n.code}:${n.name}`)).toEqual(['duplicate:A']);
    expect(new Set(r.system.edges.map((e) => e.id)).size).toBe(2);
    expect(validateSystem(r.system).map((i) => i.code)).toEqual(['binding-name']);
  });
});

describe('what’s there, and isn’t right', () => {
  const add = (text: string, via: string, kind: string, name: string) => {
    const r = read(text);
    const service = { id: 'new', kind };
    return write(text, withEdges(r.system, [...r.system.edges, { id: 'n', from: r.worker, to: 'new', via, binding: name }], [...r.system.services, service]));
  };

  it('doesn’t add to something that isn’t a list, and says so', () => {
    const text = '{ "name": "w", "kv_namespaces": { "binding": "X" } }';
    const w = add(text, 'kv_namespaces', 'kv', 'N');
    expect(w.text).toBe(text);
    expect(w.skipped).toEqual([{ edge: 'n', reason: expect.stringContaining('`kv_namespaces` isn’t what it should be') }]);
    expect(w.differences).toEqual([]);
  });

  it('nor to something under what isn’t an object', () => {
    for (const text of ['{ "name": "w", "queues": [] }', '{ "name": "w", "queues": { "producers": {} } }', '{ "name": "w", "durable_objects": [] }']) {
      const via = text.includes('durable_objects') ? 'durable_objects' : 'queues';
      const w = add(text, via, via === 'queues' ? 'queues' : 'durable-objects', 'N');
      expect(w.text, text).toBe(text);
      expect(w.skipped.map((x) => x.edge), text).toEqual(['n']);
      expect(parses(w.text), text).toEqual([]);
    }
    const text = '{ "name": "w", "queues": [] }';
    const r = read(text);
    const q = { id: 'q', kind: 'queues', resource: 'jobs' };
    const w = write(text, withEdges(r.system, [{ id: 'c', from: 'q', to: r.worker, via: 'queue-consumer' }], [...r.system.services, q]));
    expect(w.text).toBe(text);
    expect(w.skipped).toEqual([{ edge: 'c', reason: expect.stringContaining('`queues.consumers` isn’t what it should be') }]);
  });

  it('nor one that’s a key of its own, where something else is', () => {
    const text = '{ "name": "w", "browser": [] }';
    const w = add(text, 'browser', 'browser-run', 'B');
    expect(w.text).toBe(text);
    expect(w.skipped.map((x) => x.edge)).toEqual(['n']);
  });

  it('gives a key of its own with no name one', () => {
    const text = '{ "name": "w", "browser": {} }';
    expect(add(text, 'browser', 'browser-run', 'B').text).toBe('{ "name": "w", "browser": { "binding": "B" } }');
    const more = '{ "name": "w", "browser": { "remote": true } }';
    expect(add(more, 'browser', 'browser-run', 'B').text).toBe('{ "name": "w", "browser": { "remote": true, "binding": "B" } }');
  });

  it('has only the one of a key of its own', () => {
    const r = read('{ "name": "w" }');
    const ai = { id: 'ai', kind: 'workers-ai' };
    const w = write('{ "name": "w" }', withEdges(r.system, [{ id: 'one', from: r.worker, to: 'ai', via: 'ai', binding: 'AI' }, { id: 'two', from: r.worker, to: 'ai', via: 'ai', binding: 'OTHER' }], [...r.system.services, ai]));
    expect(w.text).toBe('{ "name": "w", "ai": { "binding": "AI" } }');
    expect(w.skipped).toEqual([{ edge: 'two', reason: 'A Worker has one `ai`, and that’s called AI.' }]);
    expect(parses(w.text)).toEqual([]);
  });

  it('counts a binding reached through another’s method as that binding', () => {
    const r = read('{ "name": "w" }');
    const gateway = { id: 'gw', kind: 'ai-gateway' };
    const system = withEdges(r.system, [{ id: 'one', from: r.worker, to: 'gw', via: 'ai.gateway', binding: 'AI' }], [...r.system.services, gateway]);
    const w = write('{ "name": "w" }', system);
    expect(w.text).toBe('{ "name": "w", "ai": { "binding": "AI" } }');
    const again = compareWrangler(w.text, system);
    expect(again.ok && again.differences).toEqual([]);
  });

  it('leaves two of one name as they are, and doesn’t add a second of one', () => {
    const text = '{ "name": "w", "kv_namespaces": [{ "binding": "A", "id": "1" }, { "binding": "A", "id": "2" }] }';
    const r = read(text);
    expect(write(text, r.system).text).toBe(text);
    const one = '{ "name": "w", "r2_buckets": [{ "binding": "A" }] }';
    const s = read(one);
    const twice = write(one, withEdges(s.system, [...s.system.edges, { id: 'again', from: s.worker, to: s.system.edges[0]!.to, via: 'r2_buckets', binding: 'A' }]));
    expect(twice.text).toBe(one);
    expect(twice.skipped).toEqual([{ edge: 'again', reason: 'There’s already a binding called A.' }]);
  });
});

describe('what isn’t a config', () => {
  const TOML = `# A TOML config.
name = "my-worker"
main = "src/index.ts"

[[r2_buckets]]
binding = "FILES"
bucket_name = "uploads"
`;

  it('says TOML’s TOML, reading and writing, and changes nothing', () => {
    const r = readWrangler(TOML);
    expect(r).toMatchObject({ ok: false, kind: 'toml', reason: expect.stringContaining('That’s TOML') });
    expect(writeWrangler(TOML, { services: [{ id: 'w', kind: 'workers' }], edges: [] })).toEqual({ ok: false, kind: 'toml', reason: expect.stringContaining('That’s TOML') });
    expect(compareWrangler(TOML, { services: [{ id: 'w', kind: 'workers' }], edges: [] })).toMatchObject({ ok: false });
    expect(readWrangler('[vars]\nA = 1\n')).toMatchObject({ kind: 'toml' });
    expect(readWrangler('[[d1_databases]]\nbinding = "DB"\n')).toMatchObject({ kind: 'toml' });
  });

  it('says what’s wrong with JSONC that’s wrong, and where', () => {
    expect(readWrangler('{ "name": "w",\n  "main" "x" }')).toEqual({ ok: false, kind: 'syntax', reason: expect.stringMatching(/That isn’t JSONC: \w+, at line 2, column \d+\./) });
    expect(readWrangler('')).toEqual({ ok: false, kind: 'syntax', reason: expect.stringContaining('That isn’t JSONC') });
    expect(readWrangler('{ "name": ')).toMatchObject({ ok: false, kind: 'syntax' });
  });

  it('says what isn’t an object', () => {
    for (const text of ['[]', '3', '"x"', 'null', 'true']) expect(readWrangler(text), text).toMatchObject({ ok: false, kind: 'shape' });
  });
});

describe('comparing', () => {
  it('lists differences by name, and what isn’t different isn’t listed', () => {
    const r = read(STORAGE);
    const q = { id: 'queues:jobs', kind: 'queues', resource: 'jobs' };
    const next: CloudflareSystem = {
      services: [...r.system.services.map((s) => (s.kind === 'kv' ? { ...s, resource: 'another' } : s)), q],
      edges: [...r.system.edges.filter((e) => e.binding !== 'DB').map((e) => (e.binding === 'BUCKET' ? { ...e, binding: 'FILES' } : e)), { id: 'n', from: r.worker, to: q.id, via: 'queues', binding: 'JOBS' }],
    };
    const c = compareWrangler(STORAGE, next);
    if (!c.ok) throw new Error(c.reason);
    expect(c.differences.map((d) => [d.kind, d.key, d.name])).toEqual([
      ['resource', 'kv_namespaces', 'KV'],
      ['renamed', 'r2_buckets', 'FILES'],
      ['removed', 'd1_databases', 'DB'],
      ['added', 'queues', 'JOBS'],
    ]);
    expect(c.differences.map((d) => d.message)).toEqual([
      'KV is for another in the system, and local-kv in the config.',
      'BUCKET, in the config, is called FILES in the system.',
      'DB (D1 Database) is in the config, and not in the system.',
      'JOBS (Queue) is in the system, and not in the config.',
    ]);
    // Writing it does what it said.
    const w = write(STORAGE, next);
    expect(w.differences).toEqual(c.differences);
    expect(compareWrangler(w.text, next)).toMatchObject({ ok: true, differences: [] });
    expect(parses(w.text)).toEqual([]);
  });
});

describe('the catalog', () => {
  it('has every field the table names, so it can’t go stale without saying so', () => {
    for (const [key, field] of Object.entries(WRANGLER_RESOURCE_FIELDS)) {
      const b = catalogBinding(key);
      expect(b, key).toBeDefined();
      expect(b!.fields.map((f) => f.name), key).toContain(field);
    }
  });

  it('has a place for every binding that’s drawn, or says why not', () => {
    const none = C.bindings.filter((b) => b.product && b.container !== 'map' && !WRANGLER_RESOURCE_FIELDS[b.key]).map((b) => b.key);
    // These have nothing behind them to name, or are a Worker's own settings.
    expect(none.sort()).toEqual(['ai', 'analytics', 'assets', 'browser', 'images', 'media', 'mtls_certificates', 'ratelimits', 'send_email', 'stream', 'version_metadata', 'worker_loaders'].sort());
  });
});

describe('many changes, in any order', () => {
  // A small repeatable generator: the same seed gives the same run, so a failure can be run again.
  const rng = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 2 ** 32; };
  const KINDS = [['r2_buckets', 'r2'], ['kv_namespaces', 'kv'], ['d1_databases', 'd1'], ['queues', 'queues'], ['browser', 'browser-run'], ['durable_objects', 'durable-objects']] as const;

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20])('stays a file that reads back as what was written, seed %i', (seed) => {
    const next = rng(seed * 7919);
    const pick = <T,>(list: readonly T[]) => list[Math.floor(next() * list.length)]!;
    let text = pick([COMMENTED, STORAGE, QUEUES, SERVICES, `﻿${DO_SHOP}`, STORAGE.replace(/\n/g, '\r\n')]);
    const allComments = commentsIn(text);
    for (let round = 0; round < 12; round++) {
      const r = read(text);
      let services = [...r.system.services];
      let edges = [...r.system.edges];
      const action = next();
      if (action < 0.34 && edges.length) {
        const gone = pick(edges);
        edges = edges.filter((e) => e !== gone);
      } else if (action < 0.67) {
        const [via, kind] = pick(KINDS);
        const id = `${kind}:r${seed}-${round}`;
        const name = `N_${round}`;
        if (via === 'browser' && edges.some((e) => e.via === 'browser')) continue;
        services = [...services, { id, kind, ...(via === 'browser' ? null : { resource: `r${seed}-${round}` }) }];
        edges = [...edges, { id: `new-${round}`, from: r.worker, to: id, via, binding: name }];
      } else {
        const named = edges.filter((e) => e.binding);
        if (!named.length) continue;
        const it_ = pick(named);
        edges = edges.map((e) => (e === it_ ? { ...e, binding: `R_${round}` } : e));
      }
      const system = { services, edges };
      const w = write(text, system);
      expect(parses(w.text), `round ${round}`).toEqual([]);
      // What's read back is what was written, and there's nothing left to do.
      const again = compareWrangler(w.text, system);
      expect(again.ok && again.differences, `round ${round}`).toEqual([]);
      const back = read(w.text);
      expect(back.system.edges.map((e) => e.binding).sort(), `round ${round}`).toEqual(edges.map((e) => e.binding).sort());
      // Nothing else in the file moves: everything it didn't touch is still there.
      for (const setting of r.settings) expect(back.settings, `round ${round}`).toContainEqual(setting);
      text = w.text;
    }
    // A comment only goes if it was inside what went.
    for (const c of commentsIn(text)) expect(allComments).toContain(c);
  });
});

describe('machines', () => {
  it('a system read from a config is a system like any other', async () => {
    const xstate = await import('xstate');
    const r = read(DO_SHOP);
    const withMachine = { ...r.system, services: r.system.services.map((s) => (s.kind === 'durable-objects' ? { ...s, machine: { initial: 'open', states: { open: {} } } } : s)) };
    expect(checkMachines(xstate, withMachine)).toEqual([]);
    expect(write(DO_SHOP, withMachine).text).toBe(DO_SHOP);
  });
});
