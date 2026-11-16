import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Diagram } from '@/components/ui/diagram'
import { useDiagramLayout } from '@/lib/diagram-layout/react'
import { generateDraft } from './generate'

const SIZES = [100, 500, 2000]

// Nothing here says where a node goes: ELK works that out in a worker, from the sizes of their words, when it's first needed.
export default function Layout() {
  const [n, setN] = useState(() => Number(new URLSearchParams(location.search).get('n')) || 100)
  const [shown, setShown] = useState(true)
  return (
    <div className="relative h-full min-h-96 w-full">
      {shown ? <Graph n={n} /> : null}
      <div className="absolute start-3 top-3 z-20 flex items-center gap-2 rounded-ctl bg-popover px-3 py-2 text-footnote text-popover-foreground shadow-hairline">
        {SIZES.map((size) => <Button key={size} size="sm" variant={size === n ? 'secondary' : 'ghost'} onClick={() => setN(size)}>{size}</Button>)}
        <Button size="sm" variant="secondary" onClick={() => setShown(!shown)}>{shown ? 'Remove it' : 'Bring it back'}</Button>
      </div>
    </div>
  )
}

function Graph({ n }: { n: number }) {
  const draft = useMemo(() => generateDraft(n), [n])
  const host = useRef<HTMLDivElement>(null)
  const laid = useDiagramLayout(draft, { host })
  return (
    <div ref={host} data-demo-host className="absolute inset-0">
      <Diagram
        nodes={laid.nodes}
        edges={laid.edges}
        loading={laid.status === 'pending'}
        aria-label={`A generated graph of ${n} nodes`}
        overlay={
          <div className="absolute end-3 bottom-3 rounded-ctl bg-popover px-3 py-2 text-footnote text-popover-foreground shadow-hairline">
            <span data-demo-status={laid.status} data-demo-engine={laid.engine}>
              {laid.status === 'ready' ? `${laid.nodes.length} nodes in ${Math.round(laid.ms ?? 0)} ms, on the ${laid.engine}` : laid.error ? laid.error.message : 'Laying out…'}
            </span>
          </div>
        }
      />
    </div>
  )
}
