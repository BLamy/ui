import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram'
import type { CloudflareEdge, CloudflareService } from '@/lib/cloudflare-services'

const ROOM = {
  id: 'room',
  initial: 'empty',
  states: { empty: { on: { VIEWER_JOINED: 'watched' } }, watched: { on: { VIEWER_LEFT: 'empty', FILE_READY: 'watched' } } },
}

// A file upload: the API puts a file in R2, R2 tells a Queue, the consumer writes a row to D1 and tells the file's Room, a
// Durable Object class of the consumer's with a machine, that it's ready.
const SERVICES: CloudflareService[] = [
  {
    id: 'api',
    kind: 'workers',
    label: 'API',
    triggers: [{ kind: 'route', pattern: 'api.example.com/uploads/*', zone: 'example.com' }],
    settings: { compatibilityDate: '2026-11-01', compatibilityFlags: ['nodejs_compat'] },
  },
  { id: 'files', kind: 'r2', label: 'Files', resource: 'uploads' },
  { id: 'jobs', kind: 'queues', label: 'Jobs', resource: 'upload-jobs' },
  { id: 'consumer', kind: 'workers', label: 'Consumer', settings: { compatibilityDate: '2026-11-01' }, migrations: [{ tag: 'v1', newSqliteClasses: ['Room'] }] },
  { id: 'room', kind: 'durable-objects', label: 'Room', resource: 'Room', host: 'consumer', handlers: ['fetch', 'webSocketMessage', 'webSocketClose'], machine: ROOM },
  { id: 'db', kind: 'd1', label: 'Uploads', resource: 'uploads-db' },
]

const EDGES: CloudflareEdge[] = [
  { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put', 'get'] },
  { id: 'files-jobs', from: 'files', to: 'jobs', via: 'events', operations: ['object-create'] },
  { id: 'jobs-consumer', from: 'jobs', to: 'consumer', via: 'queue-consumer', consumer: { batchSize: 10, retries: 3 } },
  { id: 'consumer-db', from: 'consumer', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
  { id: 'consumer-room', from: 'consumer', to: 'room', via: 'durable_objects', binding: 'ROOM', operations: ['idFromName', 'get'], events: ['FILE_READY'] },
]

export default function Upload() {
  return (
    <div className="relative h-full min-h-[560px] w-full">
      <CloudflareDiagram services={SERVICES} edges={EDGES} title="File upload" aria-label="A file upload" />
    </div>
  )
}
