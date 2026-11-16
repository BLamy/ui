import type { Meta, StoryObj } from '@storybook/react-vite';
import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram';
import { SERVICE_PRODUCTS, type CloudflareEdge, type CloudflareService } from '@/lib/cloudflare-services';
import { placeInLayers } from '@/lib/cloudflare-system';
import { readWorkerdConfig } from '@/lib/cloudflare-workerd';
import { Phone } from '../stories/frame';

const meta: Meta<typeof CloudflareDiagram> = {
  title: 'Organisms/CloudflareDiagram',
  component: CloudflareDiagram,
  args: { editable: false, direction: 'right' },
  argTypes: {
    editable: { control: 'boolean' },
    direction: { control: 'inline-radio', options: ['right', 'down', 'left', 'up'] },
    panelPresentation: { control: 'select', options: ['auto', 'column', 'drawer', 'push'] },
  },
};
export default meta;
type Story = StoryObj<typeof CloudflareDiagram>;

const ROOM = { id: 'room', initial: 'empty', states: { empty: { on: { VIEWER_JOINED: 'watched' } }, watched: { on: { VIEWER_LEFT: 'empty' } } } };

/* A file upload, placed: a Worker, R2, a Queue, a consumer, D1 and a Durable Object with a machine. */
const UPLOAD: CloudflareService[] = [
  { id: 'api', kind: 'workers', label: 'API', at: { x: 0, y: 80 } },
  { id: 'files', kind: 'r2', label: 'Files', at: { x: 340, y: 0 } },
  { id: 'jobs', kind: 'queues', label: 'Jobs', at: { x: 340, y: 170 } },
  { id: 'consumer', kind: 'workers', label: 'Consumer', at: { x: 680, y: 80 } },
  { id: 'db', kind: 'd1', label: 'Uploads', at: { x: 1020, y: 0 } },
  { id: 'room', kind: 'durable-objects', label: 'Room', machine: ROOM, at: { x: 1020, y: 170 } },
];
const UPLOAD_EDGES: CloudflareEdge[] = [
  { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put', 'get'] },
  { id: 'api-jobs', from: 'api', to: 'jobs', via: 'queues', binding: 'JOBS', operations: ['send'] },
  { id: 'files-jobs', from: 'files', to: 'jobs', via: 'events', operations: ['object-create'] },
  { id: 'jobs-consumer', from: 'jobs', to: 'consumer', via: 'queue-consumer' },
  { id: 'consumer-db', from: 'consumer', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
  { id: 'consumer-room', from: 'consumer', to: 'room', via: 'durable_objects', binding: 'ROOM', events: ['VIEWER_JOINED'] },
];

/** Read-only, the default: a picture to inspect. Nothing moves, connects or is deleted, and the panel only reads. */
export const ReadOnly: Story = {
  render: (args) => <Phone w={1360} h={640}><CloudflareDiagram {...args} services={UPLOAD} edges={UPLOAD_EDGES} aria-label="A file upload" /></Phone>,
};

/** Editing, uncontrolled: search the catalog to add a service, drag from `env` to connect, change a connection in the panel,
 *  undo and redo. */
export const Editing: Story = {
  args: { editable: true },
  render: (args) => <Phone w={1360} h={640}><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} aria-label="A file upload" /></Phone>,
};

export const Dark: Story = {
  args: { editable: true },
  render: (args) => <Phone w={1360} h={640} appearance="dark"><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} defaultSelection={{ nodes: [], edges: ['api-files'] }} aria-label="A file upload" /></Phone>,
};

/** Nothing in it yet: the empty state says how to start, and the panel has the search. */
export const Empty: Story = {
  args: { editable: true },
  render: (args) => <Phone w={1100} h={520}><CloudflareDiagram {...args} defaultServices={[]} aria-label="A new system" /></Phone>,
};

export const EmptyReadOnly: Story = {
  render: (args) => <Phone w={900} h={420}><CloudflareDiagram {...args} services={[]} aria-label="A system with nothing in it" /></Phone>,
};

/** Small: a Worker and the bucket it writes to, with the connection selected, showing R2's real methods. */
export const Small: Story = {
  args: { editable: true },
  render: (args) => <Phone w={1000} h={480}><CloudflareDiagram {...args} defaultServices={UPLOAD.slice(0, 2)} defaultEdges={UPLOAD_EDGES.slice(0, 1)} defaultSelection={{ nodes: [], edges: ['api-files'] }} /></Phone>,
};

/** Large: every service in the catalog, placed by ELK, with what isn't connected packed in rows. */
export const Large: Story = {
  render: (args) => <Phone w={1360} h={800}><CloudflareDiagram {...args} services={SERVICE_PRODUCTS.map((p) => ({ id: p.id, kind: p.id }))} defaultPanelOpen={false} aria-label="Every service in the catalog" /></Phone>,
};

/** A connection the catalog says there isn't (R2 can't bind D1): it's drawn as wrong, and selected, the panel says why. Dragging one
 *  on the board is refused with the same reason, before it's made. */
export const RefusedConnection: Story = {
  args: { editable: true },
  render: (args) => (
    <Phone w={1100} h={520}>
      <CloudflareDiagram
        {...args}
        defaultServices={[UPLOAD[0] as CloudflareService, UPLOAD[1] as CloudflareService, { id: 'db', kind: 'd1', label: 'Uploads', at: { x: 680, y: 0 } }]}
        defaultEdges={[{ id: 'not-real', from: 'files', to: 'db', via: 'd1_databases', binding: 'DB' }]}
        defaultSelection={{ nodes: [], edges: ['not-real'] }}
      />
    </Phone>
  ),
};

/** What's wrong with a system, listed with a way to each: an event nothing receives, a connection to a service that's gone, one
 *  that isn't real, a name used twice, and a kind that's not in the catalog. */
export const Notes: Story = {
  args: { editable: true },
  render: (args) => (
    <Phone w={1100} h={760}>
      <CloudflareDiagram
        {...args}
        defaultServices={[...UPLOAD.slice(0, 2), UPLOAD[5] as CloudflareService, { id: 'other', kind: 'not-in-the-catalog', at: { x: 0, y: 300 } }]}
        defaultEdges={[
          { id: 'join', from: 'api', to: 'room', via: 'durable_objects', binding: 'ROOM', events: ['NOT_RECEIVED'] },
          { id: 'gone', from: 'api', to: 'deleted', via: 'queues', binding: 'JOBS', events: ['WORK'] },
          { id: 'not-real', from: 'files', to: 'room', via: 'r2_buckets' },
          UPLOAD_EDGES[0] as CloudflareEdge,
          { id: 'twice', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES' },
        ]}
      />
    </Phone>
  ),
};

/** A service's machine opens in a StateDiagram, over the board, with one history for both. */
export const ItsMachine: Story = {
  args: { editable: true },
  render: (args) => <Phone w={1100} h={560}><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} defaultOpenMachine="room" /></Phone>,
};

/** At a phone's size the panel is a page pushed over the board, opened from the bar. */
export const OnAPhone: Story = {
  args: { editable: true },
  render: (args) => <Phone><CloudflareDiagram {...args} direction="down" defaultServices={UPLOAD.slice(0, 3).map((s) => ({ id: s.id, kind: s.kind, label: s.label }))} defaultEdges={UPLOAD_EDGES.slice(0, 2)} defaultSelection={{ nodes: [], edges: ['api-files'] }} /></Phone>,
};

export const OnAPhoneWithItsPanel: Story = {
  render: (args) => <Phone><CloudflareDiagram {...args} services={UPLOAD} edges={UPLOAD_EDGES} defaultPanelOpen defaultSelection={{ nodes: ['room'], edges: [] }} /></Phone>,
};

/** With permission of your own, an app can draw its own icons. These are only letters. */
export const OwnIcons: Story = {
  render: (args) => <Phone w={900} h={360}><CloudflareDiagram {...args} services={UPLOAD.slice(0, 2)} edges={UPLOAD_EDGES.slice(0, 1)} icon={(p) => <span className="text-caption font-semibold">{p.name.slice(0, 2)}</span>} /></Phone>,
};

const WORKERD = readWorkerdConfig(`using Workerd = import "/workerd/workerd.capnp";
const config :Workerd.Config = (
  services = [ (name = "main", worker = .main), (name = "consumer", worker = .consumer), (name = "disk", disk = (path = "data")) ],
  sockets = [ (name = "http", address = "*:8080", http = (), service = "main") ],
);
const main :Workerd.Worker = (
  modules = [ (name = "worker.js", esModule = embed "worker.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [ (name = "ROOMS", durableObjectNamespace = "Room"), (name = "CACHE", kvNamespace = "cache"), (name = "JOBS", queue = "consumer") ],
  durableObjectNamespaces = [ (className = "Room", uniqueKey = "rooms", enableSql = true) ],
  durableObjectStorage = (localDisk = "disk"),
);
const consumer :Workerd.Worker = (
  modules = [ (name = "consumer.js", esModule = embed "consumer.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [ (name = "ROOMS", durableObjectNamespace = (className = "Room", serviceName = "main")) ],
);`);

/** A workerd config.capnp, read by `readWorkerdConfig` and placed by `placeInLayers`: drawn read-only, at once, with no ELK. This
 *  is what docstream's capnp fence draws. */
export const AWorkerdConfig: Story = {
  render: (args) => {
    const system = WORKERD.ok ? placeInLayers(WORKERD.system) : { services: [], edges: [] };
    return <Phone w={1100} h={520}><CloudflareDiagram {...args} services={system.services} edges={system.edges} defaultPanelOpen={false} aria-label="config.capnp, as Cloudflare services" /></Phone>;
  },
};
