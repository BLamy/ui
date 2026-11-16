import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Diagram } from '@/components/ui/diagram'
import { useDiagramLayout } from '@/lib/diagram-layout/react'
import type { DiagramEdge, DiagramNode } from '@/lib/diagram-model'

const NODES: DiagramNode[] = [
  { id: 'one', label: 'A node sized to its words', x: 0, y: 0, w: 1, h: 1 },
  { id: 'two', label: 'And another', detail: 'with a second line', x: 320, y: 0, w: 1, h: 1 },
]
const EDGES: DiagramEdge[] = [{ id: 'e', from: 'one', to: 'two', label: 'next' }]

// A tab that isn't showing has no size and no text to measure. Both of these work it out when it's shown.
export default function Hidden() {
  const [shown, setShown] = useState(false)
  const draft = useMemo(() => ({ nodes: NODES.map(({ x: _x, y: _y, w: _w, h: _h, ...n }) => n), edges: EDGES }), [])
  const host = useRef<HTMLDivElement>(null)
  const laid = useDiagramLayout(draft, { host })
  return (
    <div className="grid h-full min-h-[520px] w-full grid-rows-[auto_1fr]">
      <div className="p-3"><Button variant="secondary" onPress={() => setShown(!shown)}>{shown ? 'Hide the tab' : 'Show the tab'}</Button></div>
      <div className="grid grid-rows-2 gap-2" style={{ display: shown ? undefined : 'none' }}>
        <div data-demo="sized" className="relative"><Diagram nodes={NODES} edges={EDGES} autoSize aria-label="Sized to its words" /></div>
        <div ref={host} data-demo="laid" className="relative"><Diagram nodes={laid.nodes} edges={laid.edges} aria-label="Laid out" /></div>
      </div>
    </div>
  )
}
