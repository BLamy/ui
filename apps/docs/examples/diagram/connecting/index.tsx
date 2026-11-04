import { useState } from 'react'
import { Diagram, type DiagramChange } from '@/components/ui/diagram'
import type { DiagramEdge, DiagramNode } from '@/lib/diagram-model'

const NODES: DiagramNode[] = [
  {
    id: 'worker', label: 'Worker', x: 40, y: 80, w: 130, h: 80,
    ports: [{ id: 'sql', side: 'r', at: 0.25, kind: 'sql', label: 'DB', direction: 'out' }, { id: 'files', side: 'r', at: 0.75, kind: 'files', label: 'BUCKET', direction: 'out' }, { id: 'requests', side: 'l', label: 'requests', direction: 'in' }],
  },
  { id: 'd1', label: 'D1', x: 300, y: 40, w: 110, h: 50, ports: [{ id: 'in', side: 'l', kind: 'sql', label: 'queries', direction: 'in' }] },
  { id: 'r2', label: 'R2', x: 300, y: 150, w: 110, h: 50, ports: [{ id: 'in', side: 'l', kind: 'files', label: 'objects', direction: 'in' }] },
  { id: 'plain', label: 'No ports', x: 40, y: 240, w: 110, h: 40 },
  { id: 'other', label: 'Nor here', x: 300, y: 240, w: 110, h: 40 },
  // `covered`'s port is under `lid`, and can still be reached.
  { id: 'covered', label: 'Covered', x: 480, y: 40, w: 110, h: 60, ports: [{ id: 'in', side: 'b', label: 'under the lid', direction: 'in' }] },
  { id: 'lid', label: 'Lid', x: 460, y: 85, w: 150, h: 50 },
]

const EDGES: DiagramEdge[] = [{ id: 'first', from: 'worker', fromPort: 'sql', to: 'd1', toPort: 'in' }]

const describe = (edges: readonly DiagramEdge[]) => edges.map((e) => `${e.from}${e.fromPort ? `.${e.fromPort}` : ''}>${e.to}${e.toPort ? `.${e.toPort}` : ''}`).join(' ')

// Drag from a port to another: it snaps to the nearest in reach, and says so if they can't connect. Select a node with no
// ports to get one on each side, or select an edge to move its ends. Or with the keys: C starts, arrows and P choose, Enter connects.
export default function Connecting() {
  const [nodes, setNodes] = useState(NODES)
  const [edges, setEdges] = useState(EDGES)
  const [changes, setChanges] = useState<DiagramChange['reason'][]>([])
  const onChange = (change: DiagramChange) => {
    setChanges((c) => [...c, change.reason])
    setNodes(change.nodes)
    setEdges(change.edges)
  }
  return (
    <div className="grid h-full min-h-[560px] w-full grid-rows-[1fr_auto]">
      <div className="relative">
        <Diagram editable nodes={nodes} edges={edges} onChange={onChange} aria-label="A Worker and what it can reach" />
      </div>
      <div className="flex items-center gap-3 border-t border-border p-3 text-footnote text-foreground">
        <span data-demo-edges={describe(edges)}>{edges.length} connections</span>
        <span data-demo-changes={changes.join(' ')}>{changes.length} changes</span>
      </div>
    </div>
  )
}
