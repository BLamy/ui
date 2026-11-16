import { useState } from 'react'
import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram'
import type { CloudflareEdge, CloudflareService } from '@/lib/cloudflare-services'

const SERVICES: CloudflareService[] = [
  { id: 'worker', kind: 'workers', at: { x: 40, y: 40 } },
  { id: 'r2', kind: 'r2', at: { x: 400, y: 20 } },
  { id: 'd1', kind: 'd1', at: { x: 400, y: 120 } },
  { id: 'queue', kind: 'queues', at: { x: 400, y: 220 } },
  { id: 'consumer', kind: 'workers', label: 'Consumer', at: { x: 40, y: 280 } },
  { id: 'dlp', kind: 'dlp', at: { x: 400, y: 340 } },
]

// Drag from `env` to something a Worker can bind to, and it offers what that can do. What can't connect says why not.
export default function Connect() {
  const [services, setServices] = useState(SERVICES)
  const [edges, setEdges] = useState<CloudflareEdge[]>([])
  return (
    <div className="grid h-full min-h-[600px] w-full grid-rows-[1fr_auto]">
      <div className="relative">
        <CloudflareDiagram
          editable
          services={services}
          edges={edges}
          onChange={(change) => { setServices(change.services); setEdges(change.edges) }}
          aria-label="A Worker and what it can reach"
        />
      </div>
      <div className="flex items-center gap-3 border-t border-border p-3 text-footnote text-foreground">
        <span data-demo-edges={edges.map((e) => `${e.from}>${e.to}:${e.via}${e.binding ? `:${e.binding}` : ''}${e.operations?.length ? `:${e.operations.join('+')}` : ''}`).join(' ')}>{edges.length} connections</span>
      </div>
    </div>
  )
}
