import { describe, expect, it } from 'vitest';
import * as xstate from 'xstate';
import { EMPTY_SYSTEM, addService, checkMachines, edgeBinding, machineEvents, machineReceives, machinesPast, parseSystem, removeServices, searchCatalog, serviceName, sharedServices, systemToJson, validateSystem, type CloudflareSystem } from './cloudflare-system';

const ROOM = { id: 'room', initial: 'idle', states: { idle: { on: { VIEWER_JOINED: 'busy' } }, busy: { on: { VIEWER_LEFT: 'idle', 'error.*': 'idle' } } } };
const CONSUMER = { id: 'consumer', initial: 'waiting', states: { waiting: { on: { R2_EVENT: 'working' } }, working: { initial: 'a', states: { a: { on: { DEEP: 'b' } }, b: {} } } } };

const SYSTEM: CloudflareSystem = {
  services: [
    { id: 'api', kind: 'workers', label: 'API', at: { x: 0, y: 0 } },
    { id: 'files', kind: 'r2', binding: 'FILES', resource: 'uploads', at: { x: 300, y: 0 } },
    { id: 'jobs', kind: 'queues' },
    { id: 'consumer', kind: 'workers', label: 'Consumer', machine: CONSUMER },
    { id: 'room', kind: 'durable-objects', label: 'Room', machine: ROOM },
  ],
  edges: [
    { id: 'upload', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put', 'get'] },
    { id: 'notify', from: 'files', to: 'jobs', via: 'events', operations: ['object-create'], events: ['R2_EVENT'] },
    { id: 'consume', from: 'jobs', to: 'consumer', via: 'queue-consumer' },
    { id: 'tell-room', from: 'consumer', to: 'room', via: 'durable_objects', binding: 'ROOM', events: ['VIEWER_JOINED'] },
  ],
};
const codes = (s: CloudflareSystem) => validateSystem(s).map((i) => i.code);
const withEdge = (patch: object, at = 0): CloudflareSystem => ({ ...SYSTEM, edges: SYSTEM.edges.map((e, i) => (i === at ? { ...e, ...patch } : e)) });

describe('saving and loading', () => {
  it('gives the same system back', () => {
    const { system, issues } = parseSystem(systemToJson(SYSTEM));
    expect(issues).toEqual([]);
    expect(system).toEqual(SYSTEM);
    expect(systemToJson(system)).toBe(systemToJson(SYSTEM));
  });

  it('reads the plan’s shape: an edge with no id, and a service’s own name on env', () => {
    const { system, issues } = parseSystem(JSON.stringify({
      services: [{ id: 'api', kind: 'workers' }, { id: 'files', kind: 'r2', binding: 'FILES' }, { id: 'room', kind: 'durable-objects', binding: 'ROOM', machine: ROOM }],
      edges: [{ from: 'api', to: 'files', via: 'r2_buckets', operations: ['put'] }, { from: 'api', to: 'room', via: 'durable_objects', events: ['VIEWER_JOINED'] }],
    }));
    expect(issues).toEqual([]);
    expect(system.edges.map((e) => e.id)).toEqual(['api-r2_buckets', 'api-durable_objects']);
    expect(validateSystem(system)).toEqual([]);
    expect(edgeBinding(system.edges[0]!, system.services[1])).toBe('FILES');
    // Once it's been saved, its ids stay as they are.
    expect(parseSystem(systemToJson(system)).system).toEqual(system);
  });

  it('keeps a machine’s config whole', () => {
    const config = { id: 'm', initial: 'a', context: { n: 1, deep: { list: [1, 'two', null] } }, states: { a: { on: { GO: [{ target: 'b', guard: 'ok' }, { target: 'a' }] }, after: { 100: 'b' } }, b: { type: 'final' } } };
    const { system } = parseSystem(systemToJson({ services: [{ id: 'm', kind: 'workers', machine: config }], edges: [] }));
    expect(system.services[0]!.machine).toEqual(config);
  });

  it('says what a save would lose', () => {
    const issues = validateSystem({ services: [{ id: 'm', kind: 'workers', machine: { initial: 'a', states: { a: { on: { GO: { guard: () => true, target: 'a' } } } } } }], edges: [] });
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', code: 'machine-code', service: 'm', message: expect.stringContaining('states.a.on.GO.guard') })]);
  });

  it('writes the same thing whichever order its fields were in', () => {
    const a = systemToJson({ services: [{ kind: 'r2', id: 'x', label: 'L' } as never], edges: [] });
    const b = systemToJson({ services: [{ id: 'x', label: 'L', kind: 'r2' } as never], edges: [] });
    expect(a).toBe(b);
  });

  it('hands back its own copy, so that changing it doesn’t change what it came from', () => {
    const text = systemToJson(SYSTEM);
    const one = parseSystem(text).system, two = parseSystem(text).system;
    (one.services[3]!.machine as { id: string }).id = 'changed';
    one.edges[0]!.operations!.push('head');
    expect((two.services[3]!.machine as { id: string }).id).toBe('consumer');
    expect(two.edges[0]!.operations).toEqual(['put', 'get']);
  });
});

describe('a file edited by hand', () => {
  const read = (v: unknown) => parseSystem(typeof v === 'string' ? v : JSON.stringify(v));

  it('says it isn’t JSON, rather than throwing', () => {
    const { system, issues } = read('{ "services": [');
    expect(system).toEqual(EMPTY_SYSTEM);
    expect(issues[0]).toMatchObject({ severity: 'error', code: 'json' });
    expect(issues[0]!.message).toContain('isn’t JSON');
  });

  it('says it isn’t a system', () => {
    for (const v of ['[]', '3', 'null', '"x"']) expect(read(v).issues[0]).toMatchObject({ code: 'shape' });
    expect(read({ services: 'nope', edges: 3 }).issues.map((i) => i.code)).toEqual(['shape', 'shape']);
    // With nothing in it, it's only empty.
    expect(read({})).toEqual({ system: EMPTY_SYSTEM, issues: [] });
  });

  it('leaves out a service it can’t use, says which, and keeps the rest', () => {
    const { system, issues } = read({ services: [{ id: 'good', kind: 'r2' }, { kind: 'r2' }, { id: 'x' }, 'nope', { id: 3, kind: 'r2' }, { id: 'good', kind: 'd1' }] });
    expect(system.services).toEqual([{ id: 'good', kind: 'r2' }]);
    expect(issues.map((i) => i.code)).toEqual(['service-shape', 'service-shape', 'service-shape', 'service-shape', 'service-duplicate']);
    expect(issues[0]!.message).toContain('services[1]');
    expect(issues[1]!.message).toContain('x has no `kind`');
    expect(issues[4]!.message).toContain('two services called good');
  });

  it('leaves out a field it can’t use, and keeps the service', () => {
    const { system, issues } = read({ services: [{ id: 'a', kind: 'r2', label: 3, binding: {}, at: { x: 'left', y: 1 }, machine: 'nope', extra: true }] });
    expect(system.services).toEqual([{ id: 'a', kind: 'r2' }]);
    expect(issues.map((i) => i.code).sort()).toEqual(['service-field', 'service-field', 'service-field', 'service-field', 'unknown-field'].sort());
    expect(issues.find((i) => i.message.includes('machine'))?.severity).toBe('error');
    expect(issues.find((i) => i.message.includes('extra'))?.severity).toBe('warning');
  });

  it('leaves out a place that’s nowhere near anything', () => {
    const { system, issues } = read({ services: [{ id: 'a', kind: 'r2', at: { x: 1e308, y: 0 } }, { id: 'b', kind: 'r2', at: { x: 10_000_000, y: -10_000_000 } }, { id: 'c', kind: 'r2', at: { x: 0, y: 10_000_001 } }] });
    expect(system.services).toEqual([{ id: 'a', kind: 'r2' }, { id: 'b', kind: 'r2', at: { x: 10_000_000, y: -10_000_000 } }, { id: 'c', kind: 'r2' }]);
    expect(issues.map((i) => i.service)).toEqual(['a', 'c']);
  });

  it('copes with an edge the same way', () => {
    const { system, issues } = read({
      services: [{ id: 'a', kind: 'workers' }],
      edges: [{ from: 'a', to: 'a' }, 'nope', { from: 'a', to: 'a', via: 'services', operations: 'get', events: [1], binding: 3, more: 1 }, { from: 'a', to: 'a', via: 'services' }, { id: 'same', from: 'a', to: 'a', via: 'services' }, { id: 'same', from: 'a', to: 'a', via: 'services' }],
    });
    expect(system.edges.map((e) => e.id)).toEqual(['a-services', 'a-services-2', 'same', 'same-2']);
    expect(system.edges[0]).toEqual({ id: 'a-services', from: 'a', to: 'a', via: 'services' });
    expect(issues.map((i) => i.code)).toEqual(['edge-shape', 'edge-shape', 'edge-field', 'edge-field', 'edge-field', 'unknown-field', 'edge-duplicate']);
  });

  it('says so for something at the top that a system doesn’t have', () => {
    expect(read({ services: [], version: 2 }).issues).toEqual([{ severity: 'warning', code: 'unknown-field', message: expect.stringContaining('version') }]);
  });

  it('isn’t fooled by a key like __proto__', () => {
    const { system } = parseSystem('{"services":[{"id":"__proto__","kind":"r2","__proto__":{"polluted":1}},{"id":"constructor","kind":"d1"}],"edges":[{"from":"__proto__","to":"constructor","via":"nope"}]}');
    expect(system.services.map((s) => s.id)).toEqual(['__proto__', 'constructor']);
    expect(({} as { polluted?: number }).polluted).toBeUndefined();
    expect(codes(system)).toEqual(['edge-not-real']);
  });

  it('finds what’s wrong with what it could read', () => {
    const { system } = read({ services: [{ id: 'a', kind: 'r2' }, { id: 'b', kind: 'd1' }], edges: [{ from: 'a', to: 'b', via: 'd1_databases' }] });
    expect(validateSystem(system)[0]).toMatchObject({ code: 'edge-not-real', message: expect.stringContaining('doesn’t run code') });
  });
});

describe('an edge', () => {
  it('passes when it’s real', () => {
    expect(validateSystem(SYSTEM)).toEqual([]);
  });

  it('has to be a real binding or handler, or it says why not', () => {
    const bad = validateSystem(withEdge({ from: 'files', to: 'api', via: 'r2_buckets' }));
    expect(bad[0]).toMatchObject({ severity: 'error', code: 'edge-not-real', edge: 'upload' });
    expect(bad[0]!.message).toContain('doesn’t run code');
    expect(validateSystem(withEdge({ via: 'd1_databases' }))[0]!.message).toContain('can’t be reached that way');
    expect(validateSystem(withEdge({ via: 'made_up' }))[0]!.message).toContain('nothing in the catalog called made_up');
    expect(validateSystem(withEdge({ via: 'queue-consumer', from: 'jobs', to: 'files' }))[0]!.message).toBe('Queues to R2: R2 can’t be reached that way.');
  });

  it('can only use what’s on offer', () => {
    const issues = validateSystem(withEdge({ operations: ['put', 'teleport'] }));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ code: 'operation', edge: 'upload' });
    expect(issues[0]!.message).toContain('R2 Bucket has no teleport');
  });

  it('needs a name on env that could be one, and is its own', () => {
    expect(validateSystem(withEdge({ binding: undefined }, 3))[0]).toMatchObject({ severity: 'warning', code: 'binding-name' });
    expect(validateSystem(withEdge({ binding: 'not a name' }))[0]).toMatchObject({ severity: 'error', code: 'binding-name' });
    const twice: CloudflareSystem = { ...SYSTEM, edges: [...SYSTEM.edges, { id: 'again', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES' }] };
    expect(validateSystem(twice)[0]).toMatchObject({ code: 'binding-name', edge: 'again', message: expect.stringContaining('two bindings called FILES') });
    // Two of a type under two names is fine, and two Workers can use one name.
    expect(validateSystem({ ...SYSTEM, edges: [...SYSTEM.edges, { id: 'again', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES_2' }, { id: 'other', from: 'consumer', to: 'files', via: 'r2_buckets', binding: 'FILES' }] })).toEqual([]);
  });

  it('says so if a kind isn’t in the catalog, and doesn’t call it wrong', () => {
    const issues = validateSystem({ services: [{ id: 'a', kind: 'not-yet' }], edges: [] });
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', code: 'unknown-kind', service: 'a' })]);
  });
});

describe('an event', () => {
  it('has to be one a connected machine can receive', () => {
    const issues = validateSystem(withEdge({ events: ['NOPE'] }, 3));
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', code: 'event-not-received', edge: 'tell-room' });
    expect(issues[0]!.message).toBe('Consumer sends NOPE to Room, whose machine doesn’t receive it.');
  });

  it('counts one past something with no machine, like a consumer past a Queue', () => {
    // R2's events go to a Queue, which has no machine, and on to the consumer, which has.
    expect(validateSystem(SYSTEM)).toEqual([]);
    const issues = validateSystem(withEdge({ events: ['NOPE'] }, 1));
    expect(issues[0]!.message).toContain('to Consumer, whose machine');
  });

  it('flags one with nothing past there to receive it', () => {
    const issues = validateSystem({ services: [{ id: 'a', kind: 'workers' }, { id: 'db', kind: 'd1' }], edges: [{ id: 'e', from: 'a', to: 'db', via: 'd1_databases', binding: 'DB', events: ['HELLO', 'BYE'] }] });
    expect(issues.map((i) => i.code)).toEqual(['event-no-machine', 'event-no-machine']);
    expect(issues[0]).toMatchObject({ severity: 'warning', edge: 'e', message: 'Workers sends HELLO to D1, and there’s no machine past there to receive it.' });
    expect(issues[1]!.message).toContain('BYE');
  });

  it('stops at the first machine, as that’s what’s reached', () => {
    const past = (id: string) => machinesPast(SYSTEM, { to: id }).map((s) => s.id);
    expect(past('jobs')).toEqual(['consumer']);
    expect(past('files')).toEqual(['consumer']);
    expect(past('consumer')).toEqual(['consumer']);
    expect(past('room')).toEqual(['room']);
    expect(past('gone')).toEqual([]);
    // Taken up by the first, it doesn't count for the one past that.
    expect(validateSystem(withEdge({ events: ['VIEWER_JOINED'] }, 2))[0]).toMatchObject({ code: 'event-not-received' });
  });

  it('says it can’t be run where there’s no code to run it', () => {
    const issues = validateSystem({ services: [{ id: 'q', kind: 'queues', machine: ROOM }], edges: [] });
    expect(issues).toEqual([expect.objectContaining({ severity: 'warning', code: 'machine-no-code', service: 'q' })]);
    expect(validateSystem({ services: [{ id: 'w', kind: 'workers', machine: ROOM }, { id: 'd', kind: 'durable-objects', machine: ROOM }], edges: [] })).toEqual([]);
  });

  it('finds an event anywhere in a machine, with wildcards', () => {
    expect(machineEvents(CONSUMER)).toEqual({ events: ['DEEP', 'R2_EVENT'], anything: false });
    expect(machineEvents({ on: { '*': 'a' } }).anything).toBe(true);
    expect(machineEvents(undefined)).toEqual({ events: [], anything: false });
    expect(validateSystem(withEdge({ events: ['DEEP'] }, 2))).toEqual([]);
    expect(validateSystem(withEdge({ events: ['error.bad'] }, 3))).toEqual([]);
    expect(machineReceives(ROOM, 'error')).toBe(true);
    expect(machineReceives(ROOM, 'errors')).toBe(false);
    expect(machineReceives(ROOM, 'VIEWER')).toBe(false);
    expect(validateSystem({ services: [{ id: 'a', kind: 'workers' }, { id: 'b', kind: 'workers', machine: { on: { '*': 'x' }, initial: 'x', states: { x: {} } } }], edges: [{ id: 'e', from: 'a', to: 'b', via: 'services', binding: 'B', events: ['ANY'] }] })).toEqual([]);
  });

  it('doesn’t go round for ever where services go in a ring', () => {
    const ring: CloudflareSystem = {
      services: [{ id: 'a', kind: 'workers' }, { id: 'b', kind: 'workers' }],
      edges: [{ id: 'ab', from: 'a', to: 'b', via: 'services', binding: 'B', events: ['X'] }, { id: 'ba', from: 'b', to: 'a', via: 'services', binding: 'A' }],
    };
    expect(validateSystem(ring).map((i) => i.code)).toEqual(['event-no-machine']);
  });

  it('a machine sending to a service that’s been deleted says so', () => {
    const gone = removeServices(SYSTEM, ['room']);
    expect(gone.services.map((s) => s.id)).not.toContain('room');
    // It carried events, so it stays, to say so.
    expect(gone.edges.map((e) => e.id)).toContain('tell-room');
    const issues = validateSystem(gone);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: 'error', code: 'edge-end', edge: 'tell-room' });
    expect(issues[0]!.message).toBe('Consumer sends to room, which isn’t in this system. It carries VIEWER_JOINED.');
    // And one with no events just goes.
    expect(removeServices(SYSTEM, ['files']).edges.map((e) => e.id)).toEqual(['notify', 'consume', 'tell-room']);
    expect(removeServices(SYSTEM, ['jobs', 'files']).services.map((s) => s.id)).toEqual(['api', 'consumer', 'room']);
    expect(removeServices(SYSTEM, ['jobs', 'files']).edges.map((e) => e.id)).toEqual(['notify', 'tell-room']);
  });

  it('says so if what sends has gone', () => {
    const issues = validateSystem(removeServices(SYSTEM, ['consumer']));
    expect(issues.some((i) => i.code === 'edge-end' && i.message.startsWith('tell-room comes from consumer'))).toBe(true);
  });
});

describe('what things are called', () => {
  it('goes by its own name, then the catalog’s, then its id', () => {
    expect(serviceName({ id: 'a', kind: 'r2', label: 'Files' })).toBe('Files');
    expect(serviceName({ id: 'a', kind: 'r2' })).toBe('R2');
    expect(serviceName({ id: 'a', kind: 'not-yet' })).toBe('a');
  });

  it('counts a service’s own name when there’s none on the edge', () => {
    const twice: CloudflareSystem = { services: [{ id: 'a', kind: 'workers' }, { id: 'f', kind: 'r2', binding: 'FILES' }, { id: 'g', kind: 'r2', binding: 'FILES' }], edges: [{ id: 'x', from: 'a', to: 'f', via: 'r2_buckets' }, { id: 'y', from: 'a', to: 'g', via: 'r2_buckets' }] };
    expect(validateSystem(twice)).toEqual([expect.objectContaining({ code: 'binding-name', edge: 'y', message: expect.stringContaining('two bindings called FILES') })]);
    const own = { ...twice, edges: [twice.edges[0]!, { ...twice.edges[1]!, binding: 'OTHER' }] };
    expect(validateSystem(own)).toEqual([]);
    expect(validateSystem({ services: [{ id: 'a', kind: 'workers' }, { id: 'f', kind: 'r2', binding: '1 bad' }], edges: [{ id: 'x', from: 'a', to: 'f', via: 'r2_buckets' }] })[0]).toMatchObject({ severity: 'error', code: 'binding-name' });
  });
});

describe('machines', () => {
  it('asks XState about each', () => {
    expect(checkMachines(xstate, SYSTEM)).toEqual([]);
    const bad: CloudflareSystem = { services: [
      { id: 'a', kind: 'workers', label: 'Target', machine: { initial: 'x', states: { x: { on: { GO: 'nowhere' } } } } },
      { id: 'b', kind: 'workers', label: 'Start', machine: { initial: 'nope', states: { x: {} } } },
      { id: 'c', kind: 'workers', label: 'Fine', machine: { initial: 'x', states: { x: {} } } },
      { id: 'd', kind: 'r2' },
    ], edges: [] };
    const issues = checkMachines(xstate, bad);
    expect(issues.map((i) => i.service)).toEqual(['a', 'b']);
    expect(issues[0]!.message).toContain('Target’s machine');
    expect(issues[0]!.message).toContain('nowhere');
    expect(issues[1]!.message).toContain('nope');
  });
});

describe('the catalog, searched', () => {
  const ids = (q: string) => searchCatalog(q).map((p) => p.id);

  it('finds a service by its name, first', () => {
    expect(ids('r2')[0]).toBe('r2');
    expect(ids('Durable')[0]).toBe('durable-objects');
    expect(ids('queues')[0]).toBe('queues');
    expect(ids('flagship')[0]).toBe('flagship');
    expect(ids('WORKERS')).toContain('workers');
  });

  it('finds it by its binding, and by what it’s for', () => {
    expect(ids('kv_namespaces')[0]).toBe('kv');
    expect(ids('feature flags')).toContain('flagship');
    expect(ids('unstructured')).toContain('r2');
  });

  it('wants every word to match', () => {
    expect(ids('r2 nonsense')).toEqual([]);
    expect(ids('')).toEqual([]);
    expect(ids('   ')).toEqual([]);
    expect(ids('zzzzzz')).toEqual([]);
  });

  it('finds what can go on a diagram, and not a docs page or a tool', () => {
    expect(ids('terraform')).toEqual([]);
    expect(ids('style guide')).toEqual([]);
    expect(ids('firewall rules')).toContain('firewall');
    expect(searchCatalog('a', 5)).toHaveLength(5);
  });

  it('adds a service, with an id of its own', () => {
    const one = addService(EMPTY_SYSTEM, 'r2');
    expect(one.id).toBe('r2');
    const two = addService(one.system, 'r2');
    expect(two.id).toBe('r2-2');
    const three = addService(two.system, 'r2');
    expect(three.id).toBe('r2-3');
    expect(three.system.services).toHaveLength(3);
    expect(EMPTY_SYSTEM.services).toEqual([]);
  });
});

describe('two systems sharing a service', () => {
  const a: CloudflareSystem = { services: [{ id: 'db', kind: 'd1' }, { id: 'room', kind: 'durable-objects', machine: ROOM }, { id: 'one', kind: 'workers' }], edges: [{ id: 'x', from: 'one', to: 'db', via: 'd1_databases', binding: 'DB' }] };
  const b: CloudflareSystem = { services: [{ id: 'db', kind: 'd1' }, { id: 'room', kind: 'durable-objects', machine: CONSUMER }, { id: 'room2', kind: 'r2' }, { id: 'two', kind: 'workers' }], edges: [{ id: 'x', from: 'two', to: 'db', via: 'd1_databases', binding: 'DATABASE' }] };

  it('says what they share, and whether their machines agree', () => {
    expect(sharedServices(a, b)).toEqual([{ id: 'db', kind: 'd1', sameMachine: true }, { id: 'room', kind: 'durable-objects', sameMachine: false }]);
    expect(sharedServices(a, EMPTY_SYSTEM)).toEqual([]);
  });

  it('keeps each its own: taking it from one leaves the other', () => {
    const gone = removeServices(a, ['db']);
    expect(gone.services.map((s) => s.id)).toEqual(['room', 'one']);
    expect(b.services.map((s) => s.id)).toContain('db');
    expect(validateSystem(b)).toEqual([]);
    expect(validateSystem(gone)).toEqual([]);
  });

  it('checks each by what’s in it, whatever the other says', () => {
    expect(validateSystem(a)).toEqual([]);
    expect(validateSystem({ ...b, edges: [...b.edges, { id: 'y', from: 'two', to: 'room', via: 'durable_objects', binding: 'ROOM', events: ['VIEWER_JOINED'] }] })[0]).toMatchObject({ code: 'event-not-received' });
  });
});
