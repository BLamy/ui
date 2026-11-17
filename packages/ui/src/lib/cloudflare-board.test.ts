import { describe, expect, it } from 'vitest';
import { CLOUDFLARE_SYSTEM_NODE, cloudflareBoardData as cloudflareBoard, cloudflareBoardBounds, cloudflareEnvironmentNode, placeInLayers } from './cloudflare-board';
import type { CloudflareSystem } from './cloudflare-system';
import { readWorkerdConfig } from './cloudflare-workerd';
import { intersects } from './canvas-math';

const ORDERS = `using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [
    (name = "main", worker = .main),
    (name = "broker", worker = .broker),
    (name = "consumer", worker = .consumer),
  ],
  sockets = [ (name = "http", address = "*:8080", http = (), service = "main") ],
);
const main :Workerd.Worker = (
  compatibilityDate = "2026-01-01",
  modules = [ (name = "main.js", esModule = embed "main.js") ],
  durableObjectNamespaces = [ (className = "Order", uniqueKey = "orders") ],
  bindings = [ (name = "ORDERS", durableObjectNamespace = "Order"), (name = "QUEUE", queue = "broker") ],
);
const broker :Workerd.Worker = (
  compatibilityDate = "2026-01-01",
  modules = [ (name = "broker.js", esModule = embed "broker.js") ],
  bindings = [ (name = "CONSUMER", service = "consumer") ],
);
const consumer :Workerd.Worker = (
  compatibilityDate = "2026-01-01",
  modules = [ (name = "consumer.js", esModule = embed "consumer.js") ],
  bindings = [ (name = "ORDERS", durableObjectNamespace = (className = "Order", serviceName = "main")) ],
);
`;

const UPLOAD: CloudflareSystem = {
  name: 'Uploads',
  services: [
    { id: 'api', kind: 'workers', label: 'API', triggers: [{ kind: 'route', pattern: 'api.example.com/*' }], migrations: [{ tag: 'v1', newSqliteClasses: ['Room'] }] },
    { id: 'files', kind: 'r2', label: 'Files', resource: 'uploads' },
    { id: 'jobs', kind: 'queues', label: 'Jobs', resource: 'jobs' },
    { id: 'jobs-dlq', kind: 'queues', label: 'jobs-dlq', resource: 'jobs-dlq' },
    { id: 'consumer', kind: 'workers', label: 'Consumer' },
    { id: 'db', kind: 'd1', label: 'Uploads', resource: 'uploads' },
    { id: 'room', kind: 'durable-objects', label: 'Room', resource: 'Room', host: 'api', machine: { id: 'room', initial: 'empty', states: { empty: {}, watched: {} } } },
  ],
  edges: [
    { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put', 'get'] },
    { id: 'api-jobs', from: 'api', to: 'jobs', via: 'queues', binding: 'JOBS', operations: ['send'] },
    { id: 'files-jobs', from: 'files', to: 'jobs', via: 'events', operations: ['object-create'] },
    { id: 'jobs-consumer', from: 'jobs', to: 'consumer', via: 'queue-consumer', consumer: { batchSize: 10, retries: 3, deadLetterQueue: 'jobs-dlq' } },
    { id: 'consumer-db', from: 'consumer', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
    { id: 'consumer-room', from: 'consumer', to: 'room', via: 'durable_objects', binding: 'ROOM', operations: ['get'], events: ['FILE_READY'] },
  ],
};

const node = (system: CloudflareSystem, id: string, editable = false) => cloudflareBoard(system, { editable }).nodes.find((n) => n.id === id)!;
const edge = (system: CloudflareSystem, id: string) => cloudflareBoard(system).edges.find((e) => e.id === id)!;

describe('a service, drawn', () => {
  it('is a card: its name, its product’s glyph and name, and a section for each thing it has to say', () => {
    const api = node(UPLOAD, 'api');
    expect(api).toMatchObject({ title: 'API', icon: 'cube', trailing: 'Workers', entry: true, kind: 'group' });
    // Its bindings are the labels on its connections, so a card says each once.
    expect(api.sections!.map((s) => s.title)).toEqual(['Handlers', 'Triggers', 'Settings']);
    const db = node(UPLOAD, 'db');
    // A database whose name is what it's called says no more than its header.
    expect(db).toMatchObject({ title: 'Uploads', trailing: 'D1', kind: 'node' });
    expect(db.sections).toBeUndefined();
    expect(node(UPLOAD, 'files')).toMatchObject({ title: 'Files', description: 'bucket uploads' });
    expect(node(UPLOAD, 'room').sections!.map((s) => s.title)).toEqual(['Settings', 'Machine']);
  });

  it('has a size for what it says, from the same measures the Diagram draws with', () => {
    const api = node({ ...UPLOAD, services: UPLOAD.services.filter((s) => s.id !== 'room') }, 'api');
    const db = node(UPLOAD, 'db');
    expect(api.h).toBeGreaterThan(db.h * 2.5);
    expect(db.w).toBeGreaterThan(60);
  });

  it('has ports only when it can be edited, each on a row of its “Connect” section, in on the left and out on the right', () => {
    expect(node(UPLOAD, 'consumer').ports).toBeUndefined();
    expect(cloudflareBoard(UPLOAD).edges.every((e) => !e.fromPort && !e.toPort)).toBe(true);
    const editing = node(UPLOAD, 'consumer', true);
    const connect = editing.sections!.find((s) => s.id === 'connect')!;
    expect(connect.items.find((i) => i.title === 'env')).toMatchObject({ port: 'env', description: 'out' });
    for (const p of editing.ports!) {
      expect(p.at, p.id).toBeGreaterThan(0);
      expect(p.at, p.id).toBeLessThan(1);
    }
    expect(cloudflareBoard(UPLOAD, { editable: true }).edges.find((e) => e.id === 'consumer-db')).toMatchObject({ fromPort: 'env', toPort: 'binding:d1_databases' });
  });

  it('a kind the catalog doesn’t know says so, and one with an error is drawn as wrong', () => {
    const system: CloudflareSystem = { services: [{ id: 'x', kind: 'nope' }], edges: [] };
    expect(node(system, 'x')).toMatchObject({ trailing: 'not in the catalog', tone: 'warning' });
    const wrong = cloudflareBoard(UPLOAD, { issues: [{ severity: 'error', code: 'x', message: '', service: 'db' }, { severity: 'error', code: 'y', message: '', edge: 'api-files' }] });
    expect(wrong.nodes.find((n) => n.id === 'db')).toMatchObject({ tone: 'destructive', data: { problem: true } });
    expect(wrong.edges.find((e) => e.id === 'api-files')).toMatchObject({ tone: 'destructive' });
  });
});

describe('a connection, drawn', () => {
  it('a binding’s label: its name on env, then what it uses as chips', () => {
    expect(edge(UPLOAD, 'api-files')).toMatchObject({ title: 'FILES', sections: [{ items: [{ title: 'put', icon: 'bolt' }, { title: 'get', icon: 'bolt' }] }] });
    expect(edge(UPLOAD, 'consumer-room').sections![0]!.items.map((i) => i.title)).toEqual(['get', 'FILE_READY']);
  });

  it('a producer, a consumer, an event notification and an entrypoint each say what they are', () => {
    expect(edge(UPLOAD, 'api-jobs').sections![0]!.items.map((i) => i.title)).toEqual(['producer', 'send']);
    expect(edge(UPLOAD, 'jobs-consumer')).toMatchObject({ title: 'consumer', icon: 'tray' });
    expect(edge(UPLOAD, 'jobs-consumer').sections![0]!.items.map((i) => i.title)).toEqual(['10 per batch', '3 retries', 'jobs-dlq']);
    expect(edge(UPLOAD, 'files-jobs')).toMatchObject({ title: 'event notification', icon: 'bell', variant: 'dashed' });
    const two: CloudflareSystem = {
      services: [{ id: 'a', kind: 'workers' }, { id: 'b', kind: 'workers' }, { id: 'q', kind: 'queues' }],
      edges: [{ id: 'auth', from: 'a', to: 'b', via: 'services', binding: 'AUTH', entrypoint: 'Sessions' }, { id: 'c', from: 'q', to: 'b', via: 'queue-consumer' }],
    };
    expect(edge(two, 'auth').sections![0]!.items[0]).toMatchObject({ title: 'Sessions', description: 'entrypoint' });
    // With nothing more to say, it's a pill.
    expect(edge(two, 'c')).toMatchObject({ title: 'consumer', icon: 'tray' });
    expect(edge(two, 'c').sections).toBeUndefined();
  });

  it('where a consumer sends what it gives up on, when that queue’s on the board', () => {
    expect(edge(UPLOAD, 'dead-letter:jobs-consumer')).toMatchObject({ from: 'jobs', to: 'jobs-dlq', title: 'dead letters', variant: 'dashed', data: { deadLetter: true } });
  });
});

describe('what holds what', () => {
  it('the system holds everything, with its own header; a Worker holds its classes; an environment its services', () => {
    const system: CloudflareSystem = { ...UPLOAD, accountId: 'acc', services: UPLOAD.services.map((s) => (s.id === 'consumer' || s.id === 'db' ? { ...s, environment: 'staging' } : s)) };
    const board = cloudflareBoard(system);
    const root = board.nodes.find((n) => n.id === CLOUDFLARE_SYSTEM_NODE)!;
    expect(root).toMatchObject({ kind: 'root', title: 'Uploads', icon: 'cloud' });
    expect(root.sections![0]!.items.map((i) => i.title)).toEqual(['acc', 'api.example.com', 'staging']);
    expect(board.nodes.find((n) => n.id === 'room')!.parent).toBe('api');
    expect(board.nodes.find((n) => n.id === 'db')!.parent).toBe(cloudflareEnvironmentNode('staging'));
    expect(board.nodes.find((n) => n.id === cloudflareEnvironmentNode('staging'))).toMatchObject({ kind: 'group', variant: 'dashed', title: 'staging', parent: CLOUDFLARE_SYSTEM_NODE });
    expect(board.nodes.find((n) => n.id === 'files')!.parent).toBe(CLOUDFLARE_SYSTEM_NODE);
    expect(cloudflareBoard({ services: [], edges: [] }).nodes).toEqual([]);
  });
});

describe('placeInLayers', () => {
  const cards = (system: CloudflareSystem) => {
    const board = cloudflareBoard(placeInLayers(system));
    return { board, byId: new Map(board.nodes.map((n) => [n.id, n])) };
  };
  const inside = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;

  it('goes top to bottom: what nothing reaches first, then what it reaches', () => {
    const { byId } = cards(UPLOAD);
    const y = (id: string) => byId.get(id)!.y;
    expect(y('files')).toBeGreaterThan(y('api'));
    expect(y('jobs')).toBeGreaterThan(y('files'));
    expect(y('consumer')).toBeGreaterThan(y('jobs'));
    expect(y('db')).toBeGreaterThan(y('consumer'));
  });

  it('puts nothing on top of anything, and everything inside what holds it', () => {
    for (const system of [UPLOAD, (() => { const r = readWorkerdConfig(ORDERS); if (!r.ok) throw new Error(r.reason); return r.system; })()]) {
      const { board, byId } = cards(system);
      const services = board.nodes.filter((n) => n.data);
      for (const a of services) {
        const parent = byId.get(a.parent!)!;
        expect(inside(a, parent), `${a.id} in ${parent.id}`).toBe(true);
        for (const b of services) {
          if (a.id >= b.id || a.parent !== b.parent) continue;
          expect(intersects(a, b), `${a.id} and ${b.id}`).toBe(false);
        }
      }
    }
  });

  it('leaves room between rows for the labels on the edges that cross them', () => {
    const { byId } = cards(UPLOAD);
    const consumer = byId.get('consumer')!, db = byId.get('db')!;
    expect(db.y - (consumer.y + consumer.h)).toBeGreaterThanOrEqual(56);
  });

  it('is the same every time, keeps a place that was given, and a circle doesn’t stop it', () => {
    expect(placeInLayers(UPLOAD)).toEqual(placeInLayers(UPLOAD));
    const kept = placeInLayers({ ...UPLOAD, services: UPLOAD.services.map((s) => (s.id === 'api' ? { ...s, at: { x: 5, y: 7 } } : s)) });
    expect(kept.services.find((s) => s.id === 'api')!.at).toEqual({ x: 5, y: 7 });
    expect(kept.services.every((s) => s.at)).toBe(true);
    const circle = placeInLayers({ services: [{ id: 'a', kind: 'workers' }, { id: 'b', kind: 'workers' }], edges: [{ id: '1', from: 'a', to: 'b', via: 'services' }, { id: '2', from: 'b', to: 'a', via: 'services' }] });
    expect(circle.services.every((s) => s.at)).toBe(true);
  });

  it('says how big the drawing is', () => {
    expect(cloudflareBoardBounds(UPLOAD)).toBeNull();
    const box = cloudflareBoardBounds(placeInLayers(UPLOAD))!;
    expect(box.x).toBeLessThanOrEqual(0);
    expect(box.w).toBeGreaterThan(300);
    expect(box.h).toBeGreaterThan(box.w * 0.8);
  });
});
