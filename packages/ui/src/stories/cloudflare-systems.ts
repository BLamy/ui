/* Story data: three real Cloudflare systems (a link shortener, a file upload, a docs search in two environments) and a
   workerd config, as the CloudflareDiagram stories draw them and the diagram family's layout invariants check them. */
import type { CloudflareEdge, CloudflareService } from '@/lib/cloudflare-services';

/** A link shortener: one Worker on a route, its links in KV and its clicks in D1. */
export const SMALL: CloudflareService[] = [
  { id: 'shortener', kind: 'workers', label: 'Shortener', triggers: [{ kind: 'route', pattern: 'sho.rt/*', zone: 'sho.rt' }], settings: { compatibilityDate: '2026-11-01' } },
  { id: 'links', kind: 'kv', label: 'Links' },
  { id: 'clicks', kind: 'd1', label: 'Clicks', resource: 'clicks' },
];
export const SMALL_EDGES: CloudflareEdge[] = [
  { id: 'shortener-links', from: 'shortener', to: 'links', via: 'kv_namespaces', binding: 'LINKS', operations: ['get', 'put'] },
  { id: 'shortener-clicks', from: 'shortener', to: 'clicks', via: 'd1_databases', binding: 'DB', operations: ['prepare', 'batch'] },
];

const ROOM = { id: 'room', initial: 'empty', states: { empty: { on: { VIEWER_JOINED: 'watched' } }, watched: { on: { VIEWER_LEFT: 'empty', FILE_READY: 'watched' } } } };

/** A file upload: the API puts a file in R2, R2 tells a Queue, the consumer writes a row to D1 and tells the file's Room, a
 *  Durable Object class of the consumer's with a machine. */
export const UPLOAD: CloudflareService[] = [
  { id: 'api', kind: 'workers', label: 'API', triggers: [{ kind: 'route', pattern: 'api.example.com/uploads/*', zone: 'example.com' }], settings: { compatibilityDate: '2026-11-01', compatibilityFlags: ['nodejs_compat'] } },
  { id: 'files', kind: 'r2', label: 'Files', resource: 'uploads' },
  { id: 'jobs', kind: 'queues', label: 'Jobs', resource: 'upload-jobs' },
  { id: 'consumer', kind: 'workers', label: 'Consumer', settings: { compatibilityDate: '2026-11-01' }, migrations: [{ tag: 'v1', newSqliteClasses: ['Room'] }] },
  { id: 'room', kind: 'durable-objects', label: 'Room', resource: 'Room', host: 'consumer', handlers: ['fetch', 'webSocketMessage', 'webSocketClose'], machine: ROOM },
  { id: 'db', kind: 'd1', label: 'Uploads', resource: 'uploads-db' },
];
export const UPLOAD_EDGES: CloudflareEdge[] = [
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
export const PLATFORM: CloudflareService[] = [
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
export const PLATFORM_EDGES: CloudflareEdge[] = [
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

/** A workerd config.capnp: two Workers, a socket, a disk, a Durable Object class. */
export const WORKERD_CONFIG = `using Workerd = import "/workerd/workerd.capnp";
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
);`;

/** The cloudflare-studio block's example, unplaced (the block places it with `placeInLayers(…, { editable: true })`; its
 *  test keeps the two the same). */
export const STUDIO_EXAMPLE: { services: CloudflareService[]; edges: CloudflareEdge[] } = {
  services: [
    { id: 'api', kind: 'workers', label: 'API' },
    { id: 'files', kind: 'r2', label: 'Files' },
    { id: 'jobs', kind: 'queues', label: 'Jobs' },
    { id: 'consumer', kind: 'workers', label: 'Consumer' },
    { id: 'db', kind: 'd1', label: 'Uploads' },
    {
      id: 'room',
      kind: 'durable-objects',
      label: 'Room',
      machine: {
        id: 'room',
        initial: 'empty',
        states: {
          empty: { on: { VIEWER_JOINED: 'watched' } },
          watched: { on: { VIEWER_LEFT: 'empty', FILE_READY: 'watched' } },
        },
      },
    },
  ],
  edges: [
    { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put'] },
    { id: 'api-jobs', from: 'api', to: 'jobs', via: 'queues', binding: 'JOBS', operations: ['send'] },
    { id: 'jobs-consumer', from: 'jobs', to: 'consumer', via: 'queue-consumer' },
    { id: 'consumer-db', from: 'consumer', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
    { id: 'consumer-room', from: 'consumer', to: 'room', via: 'durable_objects', binding: 'ROOM', events: ['FILE_READY'] },
  ],
};
