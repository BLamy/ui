import { useState } from 'react'
import { Diagram, DiagramToolbar } from '@/components/ui/diagram'
import type { DiagramEdge, DiagramNode, DiagramSelection } from '@/lib/diagram-model'

const NODES: DiagramNode[] = [
  { id: 'draft', title: 'Draft', x: 0, y: 0, w: 120, h: 40 },
  { id: 'review', title: 'Review', x: 200, y: 0, w: 120, h: 40 },
  { id: 'published', title: 'Published', x: 400, y: 0, w: 120, h: 40 },
  { id: 'archived', title: 'Archived', x: 200, y: 110, w: 120, h: 40 },
]
const EDGES: DiagramEdge[] = [
  { id: 'submit', from: 'draft', to: 'review', title: 'submit' },
  { id: 'approve', from: 'review', to: 'published', title: 'approve' },
  { id: 'shelve', from: 'review', to: 'archived', title: 'shelve' },
]

// Tab to the board, then Home and the arrows: focus is a ring past a gap. Draft and Review are selected (a tint and a
// line), Published is current (a bar on its start side). Focus on Draft shows both at once.
export default function Focus() {
  const [selection, setSelection] = useState<DiagramSelection>({ nodes: ['draft', 'review'], edges: [] })
  return (
    <div className="relative h-[300px] w-full">
      <Diagram
        nodes={NODES}
        edges={EDGES}
        selection={selection}
        onSelectionChange={setSelection}
        current={{ nodes: ['published'], edges: ['approve'] }}
        overlay={<DiagramToolbar />}
        aria-label="A document’s life"
      />
    </div>
  )
}
