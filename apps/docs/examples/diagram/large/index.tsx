import { useEffect, useMemo, useRef, useState } from 'react'
import { Diagram, DiagramToolbar } from '@/components/ui/diagram'
import type { Viewport } from '@/components/ui/canvas'
import { useDiagramLayout } from '@/lib/diagram-layout/react'
import { generateDraft } from '../layout/generate'

declare global {
  interface Window {
    /** What tools/e2e/diagram-perf.mjs drives this with. */
    __diagramLarge?: {
      setViewport: (v: Viewport) => void
      viewport: () => Viewport | null
      show: (shown: boolean) => void
      bounds: () => { x: number; y: number; w: number; h: number } | undefined
      status: () => string
      nodes: () => readonly { id: string; x: number; y: number; w: number; h: number }[]
    }
  }
}

// Above 200 nodes and edges, what's out of view isn't drawn. Move around, and it's there by the time you get to it.
export default function Large() {
  const params = useMemo(() => new URLSearchParams(location.search), [])
  const n = Number(params.get('n')) || 500
  const draft = useMemo(() => generateDraft(n), [n])
  const host = useRef<HTMLDivElement>(null)
  const laid = useDiagramLayout(draft, { host })
  const [viewport, setViewport] = useState<Viewport | null>(null)
  const [shown, setShown] = useState(!params.has('hidden'))
  // What's laid out is where it starts: from there, an edit's the data.
  const [data, setData] = useState({ nodes: laid.nodes, edges: laid.edges })
  useEffect(() => setData({ nodes: laid.nodes, edges: laid.edges }), [laid.nodes, laid.edges])
  const latest = useRef({ viewport, laid })
  latest.current = { viewport, laid }
  useEffect(() => {
    window.__diagramLarge = {
      setViewport,
      viewport: () => latest.current.viewport,
      show: setShown,
      bounds: () => latest.current.laid.bounds,
      status: () => latest.current.laid.status,
      nodes: () => latest.current.laid.nodes,
    }
    return () => { delete window.__diagramLarge }
  }, [])
  return (
    <div ref={host} className="relative h-full min-h-[560px] w-full">
      {shown ? (
        <Diagram
          nodes={data.nodes}
          edges={data.edges}
          onDataChange={(next) => setData({ nodes: [...next.nodes], edges: [...next.edges] })}
          editable={params.has('editable')}
          cull={params.get('cull') === 'off' ? false : undefined}
          minimap={params.has('minimap')}
          viewport={viewport ?? undefined}
          onViewportChange={setViewport}
          loading={laid.status === 'pending'}
          overlay={<DiagramToolbar side="top" align="end" />}
          aria-label={`A generated graph of ${n} nodes`}
        />
      ) : null}
      <div data-demo-status={laid.status} className="absolute start-3 top-3 z-20 rounded-ctl bg-popover px-3 py-2 text-footnote text-popover-foreground shadow-hairline">
        {laid.status === 'ready' ? `${laid.nodes.length} nodes, ${laid.edges.length} edges` : 'Laying out…'}
      </div>
    </div>
  )
}
