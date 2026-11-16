import { useState } from 'react'
import { StateDiagram } from '@/components/ui/state-diagram'
import { Textarea } from '@/components/ui/textarea'

const SOURCE = `import { setup } from 'xstate'

export const door = setup({ guards: { hasKey: () => true } }).createMachine({
  id: 'door',
  initial: 'closed',
  states: {
    closed: { on: { OPEN: 'open', LOCK: { guard: 'hasKey', target: 'locked' } } },
    open: { on: { CLOSE: 'closed' }, after: { 5000: 'closed' } },
    locked: { on: { UNLOCK: 'closed' } },
  },
})`

// A machine's source, read without running it: the same reading as an xstate fence in Markdown, drawn on a StateDiagram you
// can run. Change the text and it's read again; what can't be read statically says so.
export default function Source() {
  const [source, setSource] = useState(SOURCE)
  return (
    <div className="grid h-full min-h-[680px] w-full grid-rows-[1fr_auto]">
      <div className="relative"><StateDiagram source={source} simulate aria-label="A door" /></div>
      <div className="border-t border-border p-3">
        <Textarea aria-label="The machine's source" rows={8} className="font-mono text-footnote" value={source} onValueChange={setSource} />
      </div>
    </div>
  )
}
