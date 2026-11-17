import { useMemo, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CloudflareDiagram, cloudflareBoardProps } from '@/components/ui/cloudflare-diagram';
import { Diagram, DiagramToolbar } from '@/components/ui/diagram';
import { placeInLayers } from '@/lib/cloudflare-board';
import { SERVICE_PRODUCTS, type CloudflareEdge, type CloudflareService } from '@/lib/cloudflare-services';
import { readWorkerdConfig } from '@/lib/cloudflare-workerd';
import { BLProvider, type AppearancePreference } from '@/lib/theme';

const meta: Meta<typeof CloudflareDiagram> = {
  title: 'Organisms/CloudflareDiagram',
  component: CloudflareDiagram,
  parameters: { layout: 'fullscreen' },
  args: { editable: false, direction: 'down' },
  argTypes: {
    editable: { control: 'boolean' },
    direction: { control: 'inline-radio', options: ['down', 'right', 'up', 'left'] },
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

/* ── Three real systems ── */

/** A link shortener: one Worker on a route, its links in KV and its clicks in D1. */
const SMALL: CloudflareService[] = [
  { id: 'shortener', kind: 'workers', label: 'Shortener', triggers: [{ kind: 'route', pattern: 'sho.rt/*', zone: 'sho.rt' }], settings: { compatibilityDate: '2026-11-01' } },
  { id: 'links', kind: 'kv', label: 'Links' },
  { id: 'clicks', kind: 'd1', label: 'Clicks', resource: 'clicks' },
];
const SMALL_EDGES: CloudflareEdge[] = [
  { id: 'shortener-links', from: 'shortener', to: 'links', via: 'kv_namespaces', binding: 'LINKS', operations: ['get', 'put'] },
  { id: 'shortener-clicks', from: 'shortener', to: 'clicks', via: 'd1_databases', binding: 'DB', operations: ['prepare', 'batch'] },
];

const ROOM = { id: 'room', initial: 'empty', states: { empty: { on: { VIEWER_JOINED: 'watched' } }, watched: { on: { VIEWER_LEFT: 'empty', FILE_READY: 'watched' } } } };

/** A file upload: the API puts a file in R2, R2 tells a Queue, the consumer writes a row to D1 and tells the file's Room, a
 *  Durable Object class of the consumer's with a machine. */
const UPLOAD: CloudflareService[] = [
  { id: 'api', kind: 'workers', label: 'API', triggers: [{ kind: 'route', pattern: 'api.example.com/uploads/*', zone: 'example.com' }], settings: { compatibilityDate: '2026-11-01', compatibilityFlags: ['nodejs_compat'] } },
  { id: 'files', kind: 'r2', label: 'Files', resource: 'uploads' },
  { id: 'jobs', kind: 'queues', label: 'Jobs', resource: 'upload-jobs' },
  { id: 'consumer', kind: 'workers', label: 'Consumer', settings: { compatibilityDate: '2026-11-01' }, migrations: [{ tag: 'v1', newSqliteClasses: ['Room'] }] },
  { id: 'room', kind: 'durable-objects', label: 'Room', resource: 'Room', host: 'consumer', handlers: ['fetch', 'webSocketMessage', 'webSocketClose'], machine: ROOM },
  { id: 'db', kind: 'd1', label: 'Uploads', resource: 'uploads-db' },
];
const UPLOAD_EDGES: CloudflareEdge[] = [
  { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put', 'get'] },
  { id: 'api-jobs', from: 'api', to: 'jobs', via: 'queues', binding: 'JOBS', operations: ['send'] },
  { id: 'files-jobs', from: 'files', to: 'jobs', via: 'events', operations: ['object-create'] },
  { id: 'jobs-consumer', from: 'jobs', to: 'consumer', via: 'queue-consumer', consumer: { batchSize: 10, retries: 3 } },
  { id: 'consumer-db', from: 'consumer', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
  { id: 'consumer-room', from: 'consumer', to: 'room', via: 'durable_objects', binding: 'ROOM', operations: ['idFromName', 'get'], events: ['FILE_READY'] },
];

const P = 'production';
/** Docs search, in two environments: a gateway calls the Search Worker's entrypoint through a service binding; an indexer runs
 *  on a schedule and through a queue with a dead-letter queue, embedding with Workers AI into a Vectorize index. */
const PLATFORM: CloudflareService[] = [
  {
    id: 'gateway', kind: 'workers', label: 'Gateway', environment: P,
    triggers: [{ kind: 'route', pattern: 'api.example.com/*', zone: 'example.com' }, { kind: 'route', pattern: 'search.example.com', customDomain: true }],
    settings: { compatibilityDate: '2026-11-01', placement: 'smart', observability: true, headSamplingRate: 0.1 },
  },
  { id: 'search', kind: 'workers', label: 'Search', environment: P, settings: { compatibilityDate: '2026-11-01', cpuMs: 50 } },
  { id: 'indexer', kind: 'workers', label: 'Indexer', environment: P, triggers: [{ kind: 'cron', schedule: '0 */6 * * *' }], settings: { compatibilityDate: '2026-11-01' } },
  { id: 'cache', kind: 'kv', label: 'Cache', environment: P },
  { id: 'requests', kind: 'workers-analytics-engine', label: 'Requests', resource: 'requests', environment: P },
  { id: 'docs-index', kind: 'vectorize', label: 'Docs index', resource: 'docs-index', environment: P },
  { id: 'docs', kind: 'd1', label: 'Docs', resource: 'docs', environment: P },
  { id: 'crawl', kind: 'queues', label: 'Crawl', resource: 'crawl', environment: P },
  { id: 'crawl-dlq', kind: 'queues', label: 'crawl-dlq', resource: 'crawl-dlq', environment: P },
  { id: 'ai', kind: 'workers-ai' },
  { id: 'gateway-staging', kind: 'workers', label: 'Gateway', environment: 'staging', triggers: [{ kind: 'workers-dev' }], settings: { compatibilityDate: '2026-11-01' } },
  { id: 'cache-staging', kind: 'kv', label: 'Cache', environment: 'staging' },
];
const PLATFORM_EDGES: CloudflareEdge[] = [
  { id: 'gateway-search', from: 'gateway', to: 'search', via: 'services', binding: 'SEARCH', entrypoint: 'SearchService', operations: ['fetch'] },
  { id: 'gateway-cache', from: 'gateway', to: 'cache', via: 'kv_namespaces', binding: 'CACHE', operations: ['get', 'put'] },
  { id: 'gateway-requests', from: 'gateway', to: 'requests', via: 'analytics_engine_datasets', binding: 'REQUESTS', operations: ['writeDataPoint'] },
  { id: 'search-ai', from: 'search', to: 'ai', via: 'ai', binding: 'AI', operations: ['run'] },
  { id: 'search-index', from: 'search', to: 'docs-index', via: 'vectorize', binding: 'INDEX', operations: ['query'] },
  { id: 'search-docs', from: 'search', to: 'docs', via: 'd1_databases', binding: 'DOCS', operations: ['prepare'] },
  { id: 'indexer-crawl', from: 'indexer', to: 'crawl', via: 'queues', binding: 'CRAWL', operations: ['send'] },
  { id: 'crawl-indexer', from: 'crawl', to: 'indexer', via: 'queue-consumer', consumer: { batchSize: 25, retries: 5, deadLetterQueue: 'crawl-dlq' } },
  { id: 'indexer-ai', from: 'indexer', to: 'ai', via: 'ai', binding: 'AI', operations: ['run'] },
  { id: 'indexer-index', from: 'indexer', to: 'docs-index', via: 'vectorize', binding: 'INDEX', operations: ['upsert'] },
  { id: 'staging-cache', from: 'gateway-staging', to: 'cache-staging', via: 'kv_namespaces', binding: 'CACHE', operations: ['get', 'put'] },
];

/** A small system: a Worker on a route (where requests come in, so it has the entry marker), its KV namespace and its D1
 *  database. Each binding's label is its name on env, then the operations it uses. */
export const Small: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={SMALL} edges={SMALL_EDGES} title="Link shortener" defaultPanelOpen={false} aria-label="A link shortener" /></Page>,
};

/** The upload pipeline: API → R2 → (an event notification) → Queue → consumer → D1, and the consumer's own Durable Object class,
 *  Room, inside it, with a machine. Read-only, the default: a picture to inspect. */
export const ReadOnly: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={UPLOAD} edges={UPLOAD_EDGES} title="File upload" aria-label="A file upload" /></Page>,
};

/** A larger one: two environments, a service binding to an entrypoint, a cron trigger, a custom domain, a consumer with a
 *  dead-letter queue, Workers AI (the account's, in no environment) and a Vectorize index. */
export const Larger: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={PLATFORM} edges={PLATFORM_EDGES} title="Docs search" accountId="4f1b9c2e7a" defaultPanelOpen={false} aria-label="Docs search, in production and staging" /></Page>,
};

/** Editing, uncontrolled: each card has a Connect section whose rows carry its ports. Search the catalog to add a service,
 *  drag from `env` to connect, change a connection in the panel, undo and redo. */
export const Editing: Story = {
  args: { editable: true },
  render: (args) => <Page><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} title="File upload" aria-label="A file upload" /></Page>,
};

export const Dark: Story = {
  render: (args) => <Page appearance="dark"><CloudflareDiagram {...args} services={UPLOAD} edges={UPLOAD_EDGES} title="File upload" defaultSelection={{ nodes: [], edges: ['api-files'] }} aria-label="A file upload" /></Page>,
};

export const LargerDark: Story = {
  render: (args) => <Page appearance="dark"><CloudflareDiagram {...args} services={PLATFORM} edges={PLATFORM_EDGES} title="Docs search" accountId="4f1b9c2e7a" defaultPanelOpen={false} aria-label="Docs search, in production and staging" /></Page>,
};

/** At a tablet's size the panel is a drawer over the board that doesn't dim it, so the board stays in sight. */
export const Tablet: Story = {
  args: { editable: true },
  render: (args) => <Page w={640}><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} defaultPanelOpen defaultSelection={{ nodes: [], edges: ['api-files'] }} aria-label="A file upload" /></Page>,
};

/** The board half as a Diagram preset: a plain `<Diagram {...cloudflareBoardProps(system)} />`, with no frame or panel. With
 *  no places of their own, the services are placed top to bottom by `placeInLayers`, with no layout engine. */
export const OnAPlainDiagram: Story = {
  render: function Render() {
    const board = useMemo(() => cloudflareBoardProps({ name: 'File upload', services: UPLOAD, edges: UPLOAD_EDGES }), []);
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

/** Every service in the catalog, placed by ELK, with what isn't connected packed in rows. */
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
        defaultServices={[UPLOAD[0] as CloudflareService, UPLOAD[1] as CloudflareService, { id: 'db', kind: 'd1', label: 'Uploads' }]}
        defaultEdges={[UPLOAD_EDGES[0] as CloudflareEdge, { id: 'not-real', from: 'files', to: 'db', via: 'd1_databases', binding: 'DB' }]}
        defaultSelection={{ nodes: [], edges: ['not-real'] }}
      />
    </Page>
  ),
};

/** What's wrong with a system, listed with a way to each: an event nothing receives, a connection to a service that's gone, one
 *  that isn't real, a name used twice, a schedule that isn't one, and a kind that's not in the catalog. */
export const Notes: Story = {
  args: { editable: true },
  render: (args) => (
    <Page>
      <CloudflareDiagram
        {...args}
        defaultServices={[{ ...(UPLOAD[0] as CloudflareService), triggers: [{ kind: 'cron', schedule: 'hourly' }] }, UPLOAD[1] as CloudflareService, { ...(UPLOAD[4] as CloudflareService), host: undefined }, { id: 'other', kind: 'not-in-the-catalog' }]}
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

/** A service's machine opens in a StateDiagram, over the board, with one history for both. On the board, its card's Machine
 *  chip opens it too. */
export const ItsMachine: Story = {
  args: { editable: true },
  render: (args) => <Page><CloudflareDiagram {...args} defaultServices={UPLOAD} defaultEdges={UPLOAD_EDGES} defaultOpenMachine="room" /></Page>,
};

/** At a phone's size the board is the page, top to bottom, and the panel is a page pushed over it, opened from the bar. */
export const OnAPhone: Story = {
  render: (args) => <Page w={390}><CloudflareDiagram {...args} services={SMALL} edges={SMALL_EDGES} title="Link shortener" aria-label="A link shortener" /></Page>,
};

export const OnAPhoneEditing: Story = {
  args: { editable: true },
  render: (args) => <Page w={390}><CloudflareDiagram {...args} defaultServices={UPLOAD.slice(0, 3)} defaultEdges={UPLOAD_EDGES.slice(0, 2)} defaultSelection={{ nodes: [], edges: ['api-files'] }} /></Page>,
};

export const OnAPhoneWithItsPanel: Story = {
  render: (args) => <Page w={390}><CloudflareDiagram {...args} services={UPLOAD} edges={UPLOAD_EDGES} defaultPanelOpen defaultSelection={{ nodes: ['room'], edges: [] }} /></Page>,
};

/** With permission of your own, an app can draw its own icons, in the header's glyph's place. These are only letters. */
export const OwnIcons: Story = {
  render: (args) => <Page><CloudflareDiagram {...args} services={SMALL} edges={SMALL_EDGES} icon={(p) => <span className="text-caption2 font-semibold">{p.name.slice(0, 2)}</span>} /></Page>,
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

/** A workerd config.capnp, read by `readWorkerdConfig` and placed by `placeInLayers`: drawn read-only, at once, with no ELK. Its
 *  socket is where requests come in, and Room is inside the Worker whose class it is. This is what docstream's capnp fence draws. */
export const AWorkerdConfig: Story = {
  render: (args) => {
    const system = WORKERD.ok ? placeInLayers(WORKERD.system) : { services: [], edges: [] };
    return <Page><CloudflareDiagram {...args} services={system.services} edges={system.edges} title="config.capnp" defaultPanelOpen={false} aria-label="config.capnp, as Cloudflare services" /></Page>;
  },
};
