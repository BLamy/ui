import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Diagram, DiagramToolbar, type DiagramData } from '@/components/ui/diagram'
import {
  DiagramFrame, DiagramFrameBar, DiagramFrameBoard, DiagramFrameCover, DiagramFrameInput, DiagramFramePanel, DiagramFrameSection,
} from '@/components/ui/diagram-frame'
import type { DiagramSelection } from '@/lib/diagram-model'

const START: DiagramData = {
  nodes: [
    { id: 'inbox', label: 'Inbox', x: 0, y: 40, w: 110, h: 40 },
    { id: 'triage', label: 'Triage', x: 200, y: 40, w: 110, h: 40 },
    { id: 'archive', label: 'Archive', x: 400, y: 0, w: 110, h: 40 },
    { id: 'reply', label: 'Reply', x: 400, y: 90, w: 110, h: 40 },
  ],
  edges: [
    { id: 'sort', from: 'inbox', to: 'triage', label: 'sort' },
    { id: 'done', from: 'triage', to: 'archive', label: 'done' },
    { id: 'answer', from: 'triage', to: 'reply', label: 'answer' },
  ],
}

// The frame measures itself: a column beside the board when there's the room, a drawer that leaves the board in
// sight when there's less, and a page pushed over it on a phone. The bar on the board opens it while it's closed.
function Inspector() {
  const [data, setData] = useState(START)
  const [selection, setSelection] = useState<DiagramSelection>({ nodes: ['triage'], edges: [] })
  const [inside, setInside] = useState<string | null>(null)
  const node = selection.nodes.length === 1 ? data.nodes.find((n) => n.id === selection.nodes[0]) : undefined
  const rename = (label: string) => setData((d) => ({ ...d, nodes: d.nodes.map((n) => (n.id === node?.id ? { ...n, label } : n)) }))
  return (
    <DiagramFrame>
      <DiagramFrameBoard>
        <Diagram
          editable
          nodes={data.nodes}
          edges={data.edges}
          onDataChange={(next) => setData(next)}
          selection={selection}
          onSelectionChange={setSelection}
          onAction={(item) => item.kind === 'node' && setInside(item.id)}
          overlay={<DiagramToolbar side="top" />}
          aria-label="Mail rules"
        />
        <DiagramFrameBar>{node ? node.label : `${data.nodes.length} steps`}</DiagramFrameBar>
      </DiagramFrameBoard>
      <DiagramFramePanel title="Inspector" backLabel="Rules">
        {node ? (
          <DiagramFrameSection title="This step">
            <DiagramFrameInput label="Name" value={node.label ?? ''} onValueCommit={rename} />
            <div><Button variant="secondary" size="sm" onClick={() => setInside(node.id)}>Open it</Button></div>
          </DiagramFrameSection>
        ) : (
          <p className="m-0 text-footnote text-foreground/70">Select a step to change it. Enter or a double click opens one.</p>
        )}
      </DiagramFramePanel>
      {inside ? (
        <DiagramFrameCover>
          <div className="flex shrink-0 items-center gap-2 border-b border-border p-2">
            <Button variant="secondary" size="sm" autoFocus onClick={() => setInside(null)}>Back to the rules</Button>
            <span className="text-footnote font-semibold">Inside {data.nodes.find((n) => n.id === inside)?.label}</span>
          </div>
          <div className="grid flex-1 place-items-center text-footnote text-foreground/70">What a step holds goes here.</div>
        </DiagramFrameCover>
      ) : null}
    </DiagramFrame>
  )
}

const widths: Record<string, number | undefined> = { wide: undefined, tablet: 600, phone: 380 }

export default function InspectorDemo({ variant = 'wide' }: { variant?: string }) {
  return (
    <div className="relative mx-auto h-[440px] w-full overflow-hidden rounded-card bg-background shadow-hairline" style={{ maxWidth: widths[variant] }}>
      <Inspector key={variant} />
    </div>
  )
}
