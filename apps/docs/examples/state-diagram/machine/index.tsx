import { StateDiagram } from '@/components/ui/state-diagram'
import { uploadMachine } from './upload-machine'

// A machine, as it is, with nothing of it run: 33 states, and all 36 ways out of them.
export default function Machine() {
  return (
    <div className="relative h-full min-h-[520px] w-full">
      <StateDiagram machine={uploadMachine as never} aria-label="A file upload" />
    </div>
  )
}
