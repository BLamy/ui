import { Diagram } from '@/components/ui/diagram'
import { UPLOAD_EDGES, UPLOAD_NODES } from './machine'

// A file upload moving through a Worker, R2, a Queue, a consumer, D1 and a Durable Object. Scroll to pan, pinch or ⌘-scroll to zoom.
export default function Machine() {
  return (
    <div className="relative h-full min-h-96 w-full">
      <Diagram nodes={UPLOAD_NODES} edges={UPLOAD_EDGES} minimap aria-label="A file upload" />
    </div>
  )
}
