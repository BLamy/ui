import { useState } from 'react'
import { Diagram, DiagramToolbar, type DiagramData, type DiagramDataChangeDetails, type DiagramDataChangeReason } from '@/components/ui/diagram'
import { Switch } from '@/components/ui/switch'
import type { DiagramEdge, DiagramNode, DiagramSelection } from '@/lib/diagram-model'

const NODES: DiagramNode[] = [
  { id: 'a', label: 'Inbox', x: 40, y: 60, w: 110, h: 36 },
  { id: 'b', label: 'Triage', x: 240, y: 60, w: 110, h: 36 },
  { id: 'c', label: 'Archive', x: 240, y: 200, w: 110, h: 36 },
  { id: 'box', kind: 'compound', label: 'Review', x: 440, y: 20, w: 300, h: 240 },
  { id: 'kid1', parent: 'box', label: 'Read', x: 470, y: 70, w: 100, h: 36 },
  { id: 'kid2', parent: 'box', label: 'Reply', x: 610, y: 170, w: 100, h: 36 },
  { id: 'far', label: 'Elsewhere', x: 40, y: 300, w: 110, h: 36 },
]

const EDGES: DiagramEdge[] = [
  { id: 'ab', from: 'a', to: 'b', label: 'sort', points: [{ x: 150, y: 78 }, { x: 240, y: 78 }], labelBox: { x: 180, y: 62, w: 24, h: 11 } },
  { id: 'bc', from: 'b', to: 'c', label: 'done', points: [{ x: 295, y: 96 }, { x: 295, y: 200 }] },
  { id: 'bk', from: 'b', to: 'kid1', label: 'open', points: [{ x: 350, y: 78 }, { x: 410, y: 78 }, { x: 410, y: 88 }, { x: 470, y: 88 }] },
  { id: 'kk', from: 'kid1', to: 'kid2' },
  { id: 'loop', from: 'c', to: 'c', label: 'again' },
]

// Drag anything: edges follow. Shift or ⌘ adds to the selection, a drag from nothing draws a marquee, Delete deletes, ⌘Z undoes.
// Or Tab here and use the keys: arrows move between nodes and along edges, Enter opens, Shift and an arrow nudges.
export default function Editing() {
  const params = new URLSearchParams(location.search)
  const controlled = !params.has('uncontrolled')
  // Left out, the diagram fits what's on it until the view's moved.
  const defaultViewport = params.has('fit') ? undefined : { x: 20, y: 20, zoom: 1 }
  const [data, setData] = useState({ nodes: NODES, edges: EDGES })
  const [refuse, setRefuse] = useState(false)
  const [changes, setChanges] = useState<DiagramDataChangeReason[]>([])
  const [selection, setSelection] = useState<DiagramSelection>({ nodes: [], edges: [] })
  const [activated, setActivated] = useState('')
  // Refusing a change is `details.cancel()`: the node goes back where it was, and there's nothing to undo.
  const onDataChange = (next: DiagramData, details: DiagramDataChangeDetails) => {
    setChanges((c) => [...c, details.reason])
    if (refuse) details.cancel()
    else setData({ nodes: [...next.nodes], edges: [...next.edges] })
  }
  return (
    <div className="grid h-full min-h-[560px] w-full grid-rows-[1fr_auto]">
      <div className="relative">
        {controlled
          ? <Diagram editable nodes={data.nodes} edges={data.edges} onDataChange={onDataChange} onSelectionChange={setSelection} onAction={(item) => setActivated(item.id)} defaultViewport={defaultViewport} overlay={<DiagramToolbar />} aria-label="A small workflow" />
          : <Diagram editable={!params.has('readonly')} defaultNodes={NODES} defaultEdges={EDGES} onDataChange={onDataChange} onSelectionChange={setSelection} onAction={(item) => setActivated(item.id)} defaultViewport={defaultViewport} overlay={<DiagramToolbar />} aria-label="A small workflow" />}
      </div>
      <div className="flex items-center gap-3 border-t border-border p-3 text-footnote text-foreground">
        <Switch checked={refuse} onCheckedChange={setRefuse} aria-label="Refuse changes" />
        <span>Refuse changes</span>
        <span data-demo-changes={changes.join(' ')}>{changes.length} changes</span>
        <span data-demo-activated={activated}>{activated ? `Opened ${activated}` : 'Enter opens'}</span>
        <span data-demo-selection={[...selection.nodes, ...selection.edges].join(' ')}>{selection.nodes.length + selection.edges.length} selected</span>
      </div>
    </div>
  )
}
