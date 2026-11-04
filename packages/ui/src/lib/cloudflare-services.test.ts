import { describe, expect, it } from 'vitest';
import { CLOUDFLARE_CATALOG as C } from './cloudflare-catalog.generated';
import { ENV_PORT, EVENTS_PORT, SERVICE_PRODUCTS, bindingName, catalogProduct, linkBetween, linkOf, methodSignature, runsCode, serviceIconName, serviceNodeHeight, servicePorts, SERVICE_NODE } from './cloudflare-services';

const ids = (kind: string, dir: 'in' | 'out') => servicePorts(kind).filter((p) => p.direction === dir).map((p) => p.id);
const ok = (a: string, ap: string | undefined, b: string, bp: string | undefined) => {
  const got = linkBetween(a, ap, b, bp);
  if (!got.ok) throw new Error(got.reason);
  return got.link;
};
const no = (a: string, ap: string | undefined, b: string, bp: string | undefined) => {
  const got = linkBetween(a, ap, b, bp);
  if (got.ok) throw new Error(`${a} to ${b} was allowed`);
  return got.reason;
};

describe('ports', () => {
  it('gives each thing what it can be reached by, and what it reaches with', () => {
    expect(ids('r2', 'in')).toEqual(['binding:r2_buckets']);
    expect(ids('r2', 'out')).toEqual(['out:events']);
    expect(ids('d1', 'in')).toEqual(['binding:d1_databases']);
    expect(ids('d1', 'out')).toEqual([]);
    expect(ids('workers', 'in')).toEqual(['binding:services', 'on:fetch', 'on:scheduled', 'on:queue', 'on:email', 'on:tail', 'on:connect']);
    expect(ids('workers', 'out')).toEqual(['env', 'sends:tail', 'sends:do-connect']);
    expect(ids('queues', 'in')).toEqual(['binding:queues', 'events']);
    expect(ids('queues', 'out')).toEqual(expect.arrayContaining(['sends:queue-consumer']));
    expect(ids('durable-objects', 'in')).toEqual(['binding:durable_objects', 'on:alarm', 'on:webSocketMessage', 'on:webSocketClose', 'on:webSocketError', 'on:connect']);
    expect(ids('durable-objects', 'out')).toEqual(['env']);
    expect(ids('workflows', 'in')).toEqual(['binding:workflows', 'on:run', 'on:waitForEvent']);
    expect(ids('ai-gateway', 'in')).toEqual(['binding:ai.gateway']);
    expect(ids('containers', 'in')).toEqual(['surface:Container']);
    expect(ids('email-service', 'in')).toEqual(['binding:send_email']);
    expect(ids('email-service', 'out')).toEqual(expect.arrayContaining(['sends:email']));
  });

  it('leaves off what’s only a Worker’s own setting', () => {
    const all = ids('workers', 'in').join();
    for (const key of ['assets', 'vars', 'secrets', 'version_metadata', 'mtls_certificates', 'ratelimits']) expect(all).not.toContain(key);
  });

  it('has none on a service with no binding or handler, or on a kind that isn’t there, and that doesn’t break anything', () => {
    expect(servicePorts('dlp')).toEqual([]);
    expect(servicePorts('realtime-turn')).toEqual([]);
    expect(servicePorts('nope')).toEqual([]);
    expect(servicePorts('rules')).toEqual([]);
  });

  it('gives every catalog service ports that fit on its node, each with a place of its own', () => {
    for (const p of C.products) {
      const ports = servicePorts(p.id);
      const seen = new Set(ports.map((x) => x.id));
      expect(seen.size, p.id).toBe(ports.length);
      const h = serviceNodeHeight(ports.filter((x) => x.direction === 'in').length, ports.filter((x) => x.direction === 'out').length);
      for (const x of ports) {
        expect(x.at!, `${p.id} ${x.id}`).toBeGreaterThan(0);
        expect(x.at!, `${p.id} ${x.id}`).toBeLessThan(1);
        expect(x.at! * h, `${p.id} ${x.id}`).toBeGreaterThanOrEqual(SERVICE_NODE.head);
        expect(x.label, `${p.id} ${x.id}`).toBeTruthy();
      }
    }
  });

  it('knows which are code', () => {
    expect(runsCode('workers')).toBe(true);
    expect(runsCode('durable-objects')).toBe(true);
    expect(runsCode('r2')).toBe(false);
    expect(ids('pages', 'out')).toEqual(['env']);
  });

  it('covers every binding that goes somewhere, on the product it goes to', () => {
    for (const b of C.bindings) {
      if (!b.product || b.container === 'map' || (b.product === 'workers' && b.key !== 'services')) continue;
      expect(ids(b.product, 'in'), b.key).toContain(`binding:${b.key}`);
    }
  });
});

describe('what can join what', () => {
  it('offers R2’s real methods from a Worker', () => {
    const link = ok('workers', ENV_PORT, 'r2', 'binding:r2_buckets');
    expect(link.kind).toBe('binding');
    expect(link.via).toBe('r2_buckets');
    expect(link.label).toBe('R2 Bucket');
    expect(link.operations.map((m) => m.name)).toEqual(['createMultipartUpload', 'delete', 'get', 'head', 'list', 'put', 'resumeMultipartUpload']);
    expect(link.operations.find((m) => m.name === 'get')?.params).toEqual(expect.arrayContaining(['key']));
  });

  it('lets anything that runs code bind to it, and nothing else', () => {
    for (const code of ['workers', 'durable-objects', 'workflows', 'pages', 'agents']) expect(ok(code, ENV_PORT, 'd1', 'binding:d1_databases').via).toBe('d1_databases');
    expect(no('r2', 'binding:r2_buckets', 'd1', 'binding:d1_databases')).toContain('how R2 is reached');
    expect(no('r2', undefined, 'd1', 'binding:d1_databases')).toContain('nothing that goes out');
    expect(no('r2', 'out:events', 'd1', 'binding:d1_databases')).toContain('through a Queue');
  });

  it('refuses a binding to a handler, or to what has no port', () => {
    expect(no('workers', ENV_PORT, 'workers', 'on:queue')).toContain('Something has to send it there');
    expect(no('workers', ENV_PORT, 'dlp', undefined)).toContain('no binding');
    expect(no('workers', ENV_PORT, 'workers', ENV_PORT)).toContain('how Workers reaches things');
  });

  it('joins a sender to the handler it sends to, and no other', () => {
    const consumer = ok('queues', 'sends:queue-consumer', 'workers', 'on:queue');
    expect(consumer.kind).toBe('handler');
    expect(consumer.via).toBe('queue-consumer');
    expect(no('queues', 'sends:queue-consumer', 'workers', 'on:fetch')).toContain('queue handler');
    expect(no('queues', 'sends:queue-consumer', 'r2', 'binding:r2_buckets')).toContain('queue handler');
    expect(ok('email-service', 'sends:email', 'workers', 'on:email').via).toBe('email');
    expect(ok('stream', 'sends:stream-webhook', 'workers', 'on:fetch').via).toBe('stream-webhook');
    expect(ok('workers', 'sends:tail', 'workers', 'on:tail').via).toBe('tail');
  });

  it('takes events through a Queue, offering what it really sends', () => {
    const link = ok('r2', 'out:events', 'queues', EVENTS_PORT);
    expect(link.kind).toBe('events');
    expect(link.operations.map((m) => m.name)).toEqual(expect.arrayContaining(['object-create', 'object-delete', 'cf.r2.bucket.created']));
    expect(no('r2', 'out:events', 'workers', 'on:queue')).toContain('through a Queue');
  });

  it('reaches what’s behind another binding, with what that hands back', () => {
    const gateway = ok('workers', ENV_PORT, 'ai-gateway', 'binding:ai.gateway');
    expect(gateway.via).toBe('ai.gateway');
    expect(gateway.operations.length).toBeGreaterThan(0);
  });

  it('lets only a Durable Object reach a Container, as that’s the only way to one', () => {
    expect(ok('durable-objects', ENV_PORT, 'containers', 'surface:Container').kind).toBe('surface');
    expect(no('workers', ENV_PORT, 'containers', 'surface:Container')).toContain('Only a Durable Object');
  });

  it('allows two bindings of the same type, as each is its own edge', () => {
    expect(ok('workers', ENV_PORT, 'r2', 'binding:r2_buckets').via).toBe(ok('workers', ENV_PORT, 'r2', 'binding:r2_buckets').via);
    expect(bindingName('R2 Bucket', [])).toBe('R2_BUCKET');
    expect(bindingName('R2 Bucket', ['R2_BUCKET'])).toBe('R2_BUCKET_2');
    expect(bindingName('R2 Bucket', ['R2_BUCKET', 'R2_BUCKET_2'])).toBe('R2_BUCKET_3');
    expect(bindingName('', [])).toBe('BINDING');
  });

  it('says so for a kind that isn’t in the catalog', () => {
    expect(no('nope', ENV_PORT, 'r2', 'binding:r2_buckets')).toContain('isn’t in the catalog');
    expect(no('workers', ENV_PORT, 'nope', 'binding:x')).toContain('isn’t in the catalog');
  });

  it('finds an edge’s ports from what it says it is, however it was made', () => {
    expect(linkOf({ via: 'r2_buckets' }, 'workers', 'r2')).toMatchObject({ ok: true, link: { fromPort: 'env', toPort: 'binding:r2_buckets' } });
    expect(linkOf({ via: 'queue-consumer' }, 'queues', 'workers')).toMatchObject({ ok: true, link: { fromPort: 'sends:queue-consumer', toPort: 'on:queue' } });
    expect(linkOf({ via: 'events' }, 'r2', 'queues')).toMatchObject({ ok: true, link: { fromPort: 'out:events', toPort: 'events' } });
    expect(linkOf({ via: 'surface:Container' }, 'durable-objects', 'containers')).toMatchObject({ ok: true, link: { toPort: 'surface:Container' } });
    expect(linkOf({ via: 'ai.gateway' }, 'workers', 'ai-gateway')).toMatchObject({ ok: true });
    expect(linkOf({ via: 'nope' }, 'workers', 'r2')).toMatchObject({ ok: false, reason: expect.stringContaining('nope') });
    // A saved edge can say anything.
    expect(linkOf({ via: 'r2_buckets' }, 'r2', 'workers')).toMatchObject({ ok: false, reason: expect.stringContaining('doesn’t run code') });
    expect(linkOf({ via: 'r2_buckets' }, 'workers', 'd1')).toMatchObject({ ok: false, reason: expect.stringContaining('can’t be reached that way') });
    expect(linkOf({ via: 'queue-consumer' }, 'r2', 'workers')).toMatchObject({ ok: false, reason: expect.stringContaining('doesn’t send that') });
    expect(linkOf({ via: 'queue-consumer' }, 'queues', 'r2').ok).toBe(false);
  });
});

describe('the words and the picture', () => {
  it('writes a method plainly', () => {
    expect(methodSignature({ name: 'get', params: ['key', 'options'] })).toBe('get(key, options)');
    expect(methodSignature({ name: 'cf.r2.bucket.created' })).toBe('cf.r2.bucket.created');
  });

  it('has a name for every service', () => {
    expect(SERVICE_PRODUCTS.length).toBe(101);
    expect(SERVICE_PRODUCTS.every((p) => p.class === 'service')).toBe(true);
    expect(catalogProduct('r2')?.name).toBe('R2');
    expect(catalogProduct('nope')).toBeUndefined();
  });

  it('picks one of the library’s own icons for each, by what it does', () => {
    expect(serviceIconName(catalogProduct('workers-ai'))).toBe('sparkle');
    expect(serviceIconName(catalogProduct('r2'))).toBe('internaldrive');
    expect(serviceIconName(catalogProduct('stream'))).toBe('video');
    expect(serviceIconName(catalogProduct('waf'))).toBe('shield');
    expect(serviceIconName(catalogProduct('workers'))).toBe('cube');
    expect(serviceIconName(undefined)).toBe('cube');
  });

  it('has no event port going to or from nothing', () => {
    expect(EVENTS_PORT).toBe('events');
    for (const p of C.products) for (const x of servicePorts(p.id)) if (x.id === 'out:events') expect(p.events.length > 0 || C.receives.some((r) => r.from === p.id && r.via), p.id).toBe(true);
  });
});
