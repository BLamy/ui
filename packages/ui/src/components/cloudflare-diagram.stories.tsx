import { useMemo, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CloudflareDiagram, cloudflareBoardProps } from '@/components/ui/cloudflare-diagram';
import { Diagram, DiagramToolbar } from '@/components/ui/diagram';
import { SERVICE_PRODUCTS, type CloudflareEdge, type CloudflareService } from '@/lib/cloudflare-services';
import { placeInLayers } from '@/lib/cloudflare-system';
import { readWorkerdConfig } from '@/lib/cloudflare-workerd';
import { BLProvider, type AppearancePreference } from '@/lib/theme';

const meta: Meta<typeof CloudflareDiagram> = {
  title: 'Organisms/CloudflareDiagram',
  component: CloudflareDiagram,
  parameters: { layout: 'fullscreen' },
  args: { editable: false, direction: 'right' },
  argTypes: {
    editable: { control: 'boolean' },
    direction: { control: 'inline-radio', options: ['right', 'down', 'left', 'up'] },
    panelPresentation: { control: 'select', options: ['auto', 'column', 'drawer', 'push'] },
  },
};
export default meta;
type Story = StoryObj<typeof CloudflareDiagram>;

/** The story's whole canvas, as an app's page would have it (`layout: 'fullscreen'`), or a phone's or a tablet's width of it. */
function Page({ children, appearance, w }: { children?: ReactNode; appearance?: AppearancePreference; w?: number }) {
  return (
    <div style={{ position: 'relative', width: w ?? '100%', height: '100dvh', overflow: 'hidden' }}>
      <BLProvider appearance={appearance}>{children}</BLProvider>
    </div>
  );
}

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
  render: (args) => <Page><CloudflareDiagram {...args} services={UPLOAD} edges={UPLOAD_EDGES} aria-label="A file upload" /></Page>,
};

/** Editing, uncontrolled: search the catalog to add a service, drag from `env` to connect, change a connection in the panel,
 *  undo and redo. */
export const Editing: Story = {
  args: { editable: true },
  render: (args) => <Page><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} aria-label="A file upload" /></Page>,
};

export const Dark: Story = {
  args: { editable: true },
  render: (args) => <Page appearance="dark"><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} defaultSelection={{ nodes: [], edges: ['api-files'] }} aria-label="A file upload" /></Page>,
};

/** At a tablet's size the panel is a drawer over the board that doesn't dim it, so the board stays in sight. */
export const Tablet: Story = {
  args: { editable: true },
  render: (args) => <Page w={640}><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} defaultPanelOpen defaultSelection={{ nodes: [], edges: ['api-files'] }} aria-label="A file upload" /></Page>,
};

/** The board half as a Diagram preset: a plain `<Diagram {...cloudflareBoardProps(system)} />`, with no frame or panel. With
 *  no places of their own, the services are placed in layers by what reaches what. */
export const OnAPlainDiagram: Story = {
  render: function Render() {
    const board = useMemo(() => cloudflareBoardProps({ services: UPLOAD.map(({ at: _at, ...s }) => s), edges: UPLOAD_EDGES }), []);
    return <Page><Diagram {...board} aria-label="A file upload" overlay={<DiagramToolbar side="top" />} /></Page>;
  },
};

/** Nothing in it yet: the empty state says how to start, and the panel has the search. */
export const Empty: Story = {
  args: { editable: true },
  render: (args) => <Page><CloudflareDiagram {...args} defaultServices={[]} aria-label="A new system" /></Page>,
};

export const EmptyReadOnly: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={[]} aria-label="A system with nothing in it" /></Page>,
};

/** Small: a Worker and the bucket it writes to, with the connection selected, showing R2's real methods. */
export const Small: Story = {
  args: { editable: true },
  render: (args) => <Page><CloudflareDiagram {...args} defaultServices={UPLOAD.slice(0, 2)} defaultEdges={UPLOAD_EDGES.slice(0, 1)} defaultSelection={{ nodes: [], edges: ['api-files'] }} /></Page>,
};

/** Large: every service in the catalog, placed by ELK, with what isn't connected packed in rows. */
export const Large: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={SERVICE_PRODUCTS.map((p) => ({ id: p.id, kind: p.id }))} defaultPanelOpen={false} aria-label="Every service in the catalog" /></Page>,
};

/** A connection the catalog says there isn't (R2 can't bind D1): it's drawn as wrong, and selected, the panel says why. Dragging one
 *  on the board is refused with the same reason, before it's made. */
export const RefusedConnection: Story = {
  args: { editable: true },
  render: (args) => (
    <Page>
      <CloudflareDiagram
        {...args}
        defaultServices={[UPLOAD[0] as CloudflareService, UPLOAD[1] as CloudflareService, { id: 'db', kind: 'd1', label: 'Uploads', at: { x: 680, y: 0 } }]}
        defaultEdges={[{ id: 'not-real', from: 'files', to: 'db', via: 'd1_databases', binding: 'DB' }]}
        defaultSelection={{ nodes: [], edges: ['not-real'] }}
      />
    </Page>
  ),
};

/** What's wrong with a system, listed with a way to each: an event nothing receives, a connection to a service that's gone, one
 *  that isn't real, a name used twice, and a kind that's not in the catalog. */
export const Notes: Story = {
  args: { editable: true },
  render: (args) => (
    <Page>
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
    </Page>
  ),
};

/** A service's machine opens in a StateDiagram, over the board, with one history for both. */
export const ItsMachine: Story = {
  args: { editable: true },
  render: (args) => <Page><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} defaultOpenMachine="room" /></Page>,
};

/** At a phone's size the panel is a page pushed over the board, opened from the bar. */
export const OnAPhone: Story = {
  args: { editable: true },
  render: (args) => <Page w={390}><CloudflareDiagram {...args} direction="down" defaultServices={UPLOAD.slice(0, 3).map((s) => ({ id: s.id, kind: s.kind, label: s.label }))} defaultEdges={UPLOAD_EDGES.slice(0, 2)} defaultSelection={{ nodes: [], edges: ['api-files'] }} /></Page>,
};

export const OnAPhoneWithItsPanel: Story = {
  render: (args) => <Page w={390}><CloudflareDiagram {...args} services={UPLOAD} edges={UPLOAD_EDGES} defaultPanelOpen defaultSelection={{ nodes: ['room'], edges: [] }} /></Page>,
};

/** With permission of your own, an app can draw its own icons. These are only letters. */
export const OwnIcons: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={UPLOAD.slice(0, 2)} edges={UPLOAD_EDGES.slice(0, 1)} icon={(p) => <span className="text-caption font-semibold">{p.name.slice(0, 2)}</span>} /></Page>,
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
    return <Page><CloudflareDiagram {...args} services={system.services} edges={system.edges} defaultPanelOpen={false} aria-label="config.capnp, as Cloudflare services" /></Page>;
  },
};
