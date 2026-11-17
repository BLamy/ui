import { useRef, useState } from 'react'
import { Diagram, DiagramToolbar, type DiagramItem } from '@/components/ui/diagram'
import { useDiagramLayout } from '@/lib/diagram-layout/react'
import { STATECHART_LIKE } from './data'

// A machine drawn with nothing but Diagram's generic parts: the machine is a root with a Context section, each state a
// card with a header strip and its entry actions as chips, Active a group, Init and Paused carry the entry marker, Error a
// glyph. A transition's label is a pill, or a card with its actions; Playing's self-transitions loop beside it. Laid out
// top to bottom by ELK, on the lined board. It's editable, so a chip can be pressed.
export default function StatechartLike() {
  const host = useRef<HTMLDivElement>(null)
  const laid = useDiagramLayout(STATECHART_LIKE, { host })
  const [pressed, setPressed] = useState<DiagramItem | null>(null)
  return (
    <div ref={host} className="relative h-dvh min-h-[640px] w-full" data-demo-status={laid.status}>
      <Diagram
        nodes={laid.nodes}
        edges={laid.edges}
        loading={laid.status === 'pending'}
        background="grid"
        editable
        movable={false}
        connectable={false}
        noun="state"
        onAction={(item) => setPressed(item)}
        overlay={(
          <>
            <DiagramToolbar />
            {pressed?.item ? <p role="status" className="absolute end-3 top-3 rounded-ctl bg-popover px-3 py-2 text-footnote text-popover-foreground shadow-hairline">Pressed {pressed.item} on {pressed.id}</p> : null}
          </>
        )}
        aria-label="Audio Player"
      />
    </div>
  )
}
