import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram'
import type { CloudflareEdge, CloudflareService } from '@/lib/cloudflare-services'

const SERVICES: CloudflareService[] = [
  { id: 'api', kind: 'workers', label: 'API' },
  { id: 'files', kind: 'r2', label: 'Files' },
  { id: 'jobs', kind: 'queues' },
  { id: 'consumer', kind: 'workers', label: 'Consumer' },
  { id: 'db', kind: 'd1' },
  {
    id: 'room',
    kind: 'durable-objects',
    label: 'Room',
    machine: { id: 'room', initial: 'empty', states: { empty: { on: { VIEWER_JOINED: 'watched' } }, watched: { on: { VIEWER_LEFT: 'empty' } } } },
  },
]

const EDGES: CloudflareEdge[] = [
  { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put', 'get'] },
  { id: 'api-jobs', from: 'api', to: 'jobs', via: 'queues', binding: 'JOBS', operations: ['send'] },
  { id: 'files-jobs', from: 'files', to: 'jobs', via: 'events', operations: ['object-create'] },
  { id: 'jobs-consumer', from: 'jobs', to: 'consumer', via: 'queue-consumer' },
  { id: 'consumer-db', from: 'consumer', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
  { id: 'consumer-room', from: 'consumer', to: 'room', via: 'durable_objects', binding: 'ROOM' },
]

// A file upload, in a Worker, R2, a Queue, a consumer, D1 and a Durable Object with a machine. Select one to see what it can do.
export default function Upload() {
  return (
    <div className="relative h-full min-h-[560px] w-full">
      <CloudflareDiagram services={SERVICES} edges={EDGES} aria-label="A file upload" />
    </div>
  )
}
