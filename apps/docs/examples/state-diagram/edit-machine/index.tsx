import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StateDiagram } from '@/components/ui/state-diagram'
import { uploadMachine } from '../machine/upload-machine'

const WITH_CODE = { id: 'inline', initial: 'a', states: { a: { entry: () => undefined, on: { GO: 'b' } }, b: {} } }

// Its implementations stay where they are. An edit only ever changes its config, and lists any new name it makes.
export default function EditMachine() {
  const [which, setWhich] = useState<'machine' | 'code'>('machine')
  return (
    <div className="grid h-full min-h-[560px] w-full grid-rows-[auto_1fr]">
      <div className="flex flex-wrap gap-2 border-b border-border p-3">
        <Button variant="secondary" size="sm" onClick={() => setWhich('machine')}>The upload</Button>
        <Button variant="secondary" size="sm" onClick={() => setWhich('code')}>With code in it</Button>
      </div>
      <div className="relative">
        {which === 'machine'
          ? <StateDiagram key="machine" machine={uploadMachine as never} editable aria-label="A file upload" />
          : <StateDiagram key="code" defaultConfig={WITH_CODE} editable />}
      </div>
    </div>
  )
}
