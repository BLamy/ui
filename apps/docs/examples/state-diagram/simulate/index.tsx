import { StateDiagram } from '@/components/ui/state-diagram'
import { uploadMachine } from '../machine/upload-machine'

// The whole upload, run in the page. Its guards, actors and timers are stand-ins, so none of its code runs.
export default function Simulate() {
  return (
    <div className="relative h-full min-h-[560px] w-full">
      <StateDiagram machine={uploadMachine as never} simulate aria-label="A file upload" />
    </div>
  )
}
