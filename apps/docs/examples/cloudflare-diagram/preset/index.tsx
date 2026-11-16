import { useMemo } from 'react'
import { cloudflareBoardProps } from '@/components/ui/cloudflare-diagram'
import { Diagram, DiagramToolbar } from '@/components/ui/diagram'
import type { CloudflareEdge, CloudflareService } from '@/lib/cloudflare-services'

const SERVICES: CloudflareService[] = [
  { id: 'api', kind: 'workers', label: 'API' },
  { id: 'files', kind: 'r2', label: 'Files' },
  { id: 'jobs', kind: 'queues', label: 'Jobs' },
  { id: 'db', kind: 'd1', label: 'Uploads' },
]

const EDGES: CloudflareEdge[] = [
  { id: 'api-files', from: 'api', to: 'files', via: 'r2_buckets', binding: 'FILES', operations: ['put', 'get'] },
  { id: 'api-jobs', from: 'api', to: 'jobs', via: 'queues', binding: 'JOBS', operations: ['send'] },
  { id: 'api-db', from: 'api', to: 'db', via: 'd1_databases', binding: 'DB', operations: ['prepare'] },
]

// The board half of a CloudflareDiagram as a Diagram preset: no frame, no panel, the same services, labels and connection
// rule. With no places of their own, they're placed in layers by what reaches what, so no layout engine loads.
export default function Preset() {
  const board = useMemo(() => cloudflareBoardProps({ services: SERVICES, edges: EDGES }), [])
  return (
    <div className="relative h-full min-h-[420px] w-full">
      <Diagram {...board} aria-label="An API and what it binds" overlay={<DiagramToolbar side="top" />} />
    </div>
  )
}
