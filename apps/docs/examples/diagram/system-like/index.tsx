import { useRef } from 'react'
import { Diagram, DiagramToolbar } from '@/components/ui/diagram'
import { useDiagramLayout } from '@/lib/diagram-layout/react'
import { SYSTEM_LIKE } from './data'

// A system of services drawn with the same parts: the system is a root with what's account-wide, each service a card whose
// header names it and its product, with what it exposes and what triggers it; a Worker holds its Durable Object class; the
// entry point has the entry marker; a binding's label is a card with the operations it uses.
export default function SystemLike() {
  const host = useRef<HTMLDivElement>(null)
  const laid = useDiagramLayout(SYSTEM_LIKE, { host })
  return (
    <div ref={host} className="relative h-dvh min-h-[640px] w-full" data-demo-status={laid.status}>
      <Diagram nodes={laid.nodes} edges={laid.edges} loading={laid.status === 'pending'} background="grid" noun="service" overlay={<DiagramToolbar />} aria-label="Uploads" />
    </div>
  )
}
