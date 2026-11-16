import { Diagram, DiagramNodeBody, DiagramToolbar } from '@/components/ui/diagram'
import type { DiagramEdge, DiagramNode } from '@/lib/diagram-model'

// Cards with their ports' names written inside, as a system of services draws them. Files' events leave on its right
// for a port on the left of a card to its left, so the route goes around the two cards rather than behind them, and the
// long label beside the consumer keeps off its port names, moving along its route until it's clear.
const NODES: DiagramNode[] = [
  { id: 'files', label: 'Files', detail: 'R2', x: 0, y: 0, w: 200, h: 90, ports: [{ id: 'events', side: 'right', label: 'events', direction: 'out' }] },
  { id: 'jobs', label: 'Jobs', detail: 'Queue', x: 0, y: 170, w: 200, h: 90, ports: [{ id: 'events', side: 'left', at: 0.35, label: 'events', direction: 'in' }, { id: 'batch', side: 'right', label: 'batch', direction: 'out' }] },
  { id: 'consumer', label: 'Consumer', detail: 'Worker', x: 400, y: 140, w: 200, h: 150, ports: [{ id: 'queue', side: 'left', at: 0.32, label: 'queue', direction: 'in' }, { id: 'email', side: 'left', label: 'email', direction: 'in' }, { id: 'env', side: 'right', label: 'env', direction: 'out' }] },
  { id: 'uploads', label: 'Uploads', detail: 'D1', x: 720, y: 160, w: 200, h: 90, ports: [{ id: 'in', side: 'left', label: 'queries', direction: 'in' }] },
]

const EDGES: DiagramEdge[] = [
  { id: 'events', from: 'files', fromPort: 'events', to: 'jobs', toPort: 'events', label: 'events' },
  { id: 'batch', from: 'jobs', fromPort: 'batch', to: 'consumer', toPort: 'queue', label: 'message batch from a Queue' },
  { id: 'db', from: 'consumer', fromPort: 'env', to: 'uploads', toPort: 'in', label: 'env.DB' },
]

// Stable, as nodes memoize on it.
const renderNode = (node: DiagramNode) => (
  <DiagramNodeBody node={node}>
    {(node.ports ?? []).map((p) => (
      <span key={p.id} className="absolute text-caption text-muted-foreground" style={{ top: `calc(${(p.at ?? 0.5) * 100}% - 0.5lh)`, ...(p.side === 'left' ? { left: 10 } : { right: 10 }) }}>
        {p.label}
      </span>
    ))}
  </DiagramNodeBody>
)

export default function Labels() {
  return (
    <div className="relative h-[420px] w-full">
      <Diagram nodes={NODES} edges={EDGES} renderNode={renderNode} overlay={<DiagramToolbar />} aria-label="An upload pipeline" />
    </div>
  )
}
