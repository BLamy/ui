import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CLOUDFLARE_CATALOG as C } from './cloudflare-catalog.generated';

const product = (id: string) => C.products.find((p) => p.id === id)!;
const binding = (key: string) => C.bindings.find((b) => b.key === key)!;
const ids = new Set(C.products.map((p) => p.id));
const methods = (key: string) => binding(key).methods.map((m) => m.name);

describe('what it was made from', () => {
  it('says which exact versions', () => {
    expect(C.pins.docs.ref).toBe('5c2ac2bf064c2b8de82fdcd6f28d245b064f8da4');
    expect(C.pins.docs.license).toBe('CC-BY-4.0');
    expect(C.pins.wrangler.version).toBe('4.157.0');
    expect(C.pins.workersTypes.version).toBe('5.20261104.1');
    expect(C.pins.docs.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('carries the credit and the trademark line', () => {
    expect(C.attribution).toContain('CC-BY-4.0');
    expect(C.attribution).toContain('cloudflare/cloudflare-docs');
    expect(C.attribution).toContain('trademark');
  });
});

describe('products', () => {
  it('has all 195 of them, each in one class', () => {
    expect(C.products).toHaveLength(195);
    const by = (c: string) => C.products.filter((p) => p.class === c).length;
    expect({ service: by('service'), feature: by('feature'), umbrella: by('umbrella'), tooling: by('tooling'), docs: by('docs') }).toEqual({ service: 101, feature: 52, umbrella: 10, tooling: 19, docs: 13 });
  });

  it('has a name for every one, and a parent that exists', () => {
    for (const p of C.products) {
      expect(p.name, p.id).toBeTruthy();
      if (p.parent) expect(ids.has(p.parent), `${p.id}'s parent ${p.parent}`).toBe(true);
      if (p.class !== 'feature') expect(p.parent, p.id).toBeNull();
    }
  });

  it('gives each feature a parent, but the one that has nothing to be part of', () => {
    expect(C.products.filter((p) => p.class === 'feature' && !p.parent).map((p) => p.id)).toEqual(['client-ip-geolocation']);
  });

  it('keeps the audit’s decisions', () => {
    // It has a binding, so it can't only be an overview.
    expect(product('analytics').class).toBe('service');
    expect(product('posture-checks').parent).toBe('access');
    expect(product('logpush').class).toBe('service');
    expect(product('cloudflare-tunnel-sase').parent).toBe('tunnel');
    expect(product('ai').class).toBe('umbrella');
    expect(product('terraform').class).toBe('tooling');
  });

  it('says why, wherever a person decided', () => {
    expect(C.products.filter((p) => p.why)).toHaveLength(44);
    expect(product('registrar').why).toContain('nothing runs through it');
  });

  it('holds no logos or images', () => {
    const text = JSON.stringify(C);
    expect(text).not.toMatch(/\.(svg|png|jpe?g|webp)\b/i);
    expect(text).not.toMatch(/"(icon|logo|image)"\s*:/);
  });
});

describe('bindings', () => {
  it('has all 41 keys, in a place each', () => {
    expect(new Set(C.bindings.map((b) => b.key)).size).toBe(41);
    expect(C.bindings).toHaveLength(41);
  });

  it('resolves each to a type with methods, or says by name why not', () => {
    const named = C.bindings.filter((b) => b.unresolved).map((b) => b.key).sort();
    expect(named).toEqual(['data_blobs', 'k2', 'logfwdr', 'secrets', 'text_blobs', 'unsafe', 'vars', 'wasm_modules']);
    for (const b of C.bindings) {
      if (b.unresolved) expect(b.runtimeType, b.key).toBeNull();
      else {
        expect(b.runtimeType, b.key).toBeTruthy();
        expect(b.methods.length + b.properties.length, b.key).toBeGreaterThan(0);
      }
    }
  });

  it('points each at a product a diagram can place, or at none', () => {
    const none = C.bindings.filter((b) => !b.product).map((b) => b.key).sort();
    expect(none).toEqual(['data_blobs', 'logfwdr', 'text_blobs', 'unsafe', 'unsafe_hello_world', 'wasm_modules']);
    for (const b of C.bindings) {
      if (b.product) expect(product(b.product).class, b.key).toBe('service');
      for (const id of Object.values(b.alsoReaches ?? {})) expect(product(id).class, `${b.key} also reaches ${id}`).toBe('service');
    }
  });

  it('has the real methods', () => {
    expect(methods('r2_buckets')).toEqual(['createMultipartUpload', 'delete', 'get', 'head', 'list', 'put', 'resumeMultipartUpload']);
    expect(methods('kv_namespaces')).toEqual(['delete', 'get', 'getWithMetadata', 'list', 'put']);
    expect(methods('queues')).toEqual(['metrics', 'send', 'sendBatch']);
    expect(methods('analytics_engine_datasets')).toEqual(['writeDataPoint']);
    expect(methods('worker_loaders')).toEqual(['get', 'load']);
    expect(binding('flagship').fields.map((f) => f.name)).toEqual(['binding', 'app_id', 'remote']);
    expect(methods('flagship')).toEqual(expect.arrayContaining(['get', 'getBooleanValue', 'getObjectDetails']));
  });

  it('has what a binding’s methods hand back, as far as there’s anything to call', () => {
    expect(binding('durable_objects').runtimeType).toBe('DurableObjectNamespace');
    expect(Object.keys(binding('durable_objects').followOn)).toContain('DurableObjectStub');
  });

  it('knows a config’s shape', () => {
    expect(binding('queues').path).toBe('queues.producers');
    expect(binding('durable_objects').path).toBe('durable_objects.bindings');
    expect(binding('durable_objects').nameField).toBe('name');
    expect(binding('r2_buckets').nameField).toBe('binding');
    expect(binding('ai').container).toBe('object');
    expect(binding('vars').container).toBe('map');
    expect(binding('r2_buckets').fields.find((f) => f.name === 'binding')?.required).toBe(true);
  });

  it('says so when it cuts a long type short', () => {
    const all = C.bindings.flatMap((b) => b.methods.flatMap((m) => [...(m.returns ?? []), ...(m.paramTypes ?? [])]));
    expect(all.some((t) => t.endsWith('…'))).toBe(true);
    for (const t of all) if (t.endsWith('…')) expect(t.length, t).toBeLessThanOrEqual(120);
  });
});

describe('what a Worker can receive', () => {
  it('has the handlers from the types', () => {
    const names = (type: string) => C.handlers.find((h) => h.type === type)!.handlers.map((m) => m.name);
    expect(names('ExportedHandler')).toEqual(expect.arrayContaining(['fetch', 'queue', 'scheduled', 'email', 'tail']));
    expect(names('DurableObject')).toEqual(expect.arrayContaining(['fetch', 'alarm', 'webSocketMessage']));
  });

  it('has all 26 rows of the table, each pointing at something that’s there', () => {
    expect(C.receives).toHaveLength(26);
    const types = new Map(C.handlers.map((h) => [h.type, h.handlers.map((m) => m.name)]));
    for (const r of C.receives) {
      if (r.from) expect(product(r.from).class, r.id).toBe('service');
      if (r.via) expect(product(r.via).class, r.id).toBe('service');
      const [type, member] = r.handler.split('.');
      if (types.has(type!)) expect(types.get(type!), r.id).toContain(member);
    }
    expect(C.receives.find((r) => r.id === 'r2-notification')).toMatchObject({ from: 'r2', via: 'queues', handler: 'ExportedHandler.queue' });
  });

  it('knows which product sends what', () => {
    expect(product('r2').sends).toEqual(['r2-notification']);
    expect(product('r2').events).toContain('cf.r2.bucket.created');
    expect(product('queues').sends).toEqual(['queue-consumer']);
    expect(product('containers').callsWithoutBinding).toEqual(['Container']);
    expect(product('ai-gateway').alsoReachedThrough).toEqual(['ai.gateway']);
  });

  it('has R2’s event categories and every event subscription', () => {
    expect(C.r2Notifications.categories.map((c) => c.category)).toEqual(['object-create', 'object-delete']);
    const count = C.eventSubscriptions.sources.reduce((n, s) => n + s.events.length, 0);
    expect(count).toBe(45);
    for (const s of C.eventSubscriptions.sources) expect(ids.has(s.product), s.heading).toBe(true);
  });
});

describe('what runs code', () => {
  it('names what can have bindings, and what holds each handler', () => {
    expect(C.runsCode.map((r) => r.product)).toEqual(['workers', 'durable-objects', 'workflows', 'pages', 'agents', 'dynamic-workers', 'workers-for-platforms']);
    const owners = new Set(C.runsCode.flatMap((r) => r.handlerTypes));
    for (const r of C.receives) expect(owners.has(r.handler.split('.')[0]!), r.id).toBe(true);
  });
});

describe('how it ships', () => {
  it('isn’t in the main entry', () => {
    const barrel = readFileSync(join(__dirname, '../index.ts'), 'utf8');
    expect(barrel).not.toContain('cloudflare-catalog');
  });

  it('is about the size the docs say', () => {
    const size = readFileSync(join(__dirname, 'cloudflare-catalog.generated.ts')).length;
    expect(size).toBeGreaterThan(120_000);
    expect(size).toBeLessThan(180_000);
  });
});
