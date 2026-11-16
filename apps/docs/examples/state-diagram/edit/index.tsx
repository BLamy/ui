import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StateDiagram } from '@/components/ui/state-diagram'
import { Textarea } from '@/components/ui/textarea'

const DOOR = {
  id: 'door',
  initial: 'closed',
  states: {
    closed: { on: { OPEN: 'open', LOCK: { guard: 'hasKey', target: 'locked' } } },
    open: { on: { CLOSE: 'closed' }, after: { 5000: 'closed' } },
    locked: { on: { UNLOCK: 'closed' }, invoke: { src: 'alarm', onDone: 'closed', onError: 'jammed' } },
    jammed: { type: 'final' },
  },
}

// The config's only data, so what you save is what you load, and what's named stays yours to write.
export default function Edit() {
  const [config, setConfig] = useState<Record<string, unknown>>(DOOR)
  const [saved, setSaved] = useState('')
  const [problem, setProblem] = useState<string | null>(null)
  const load = () => {
    try {
      setConfig(JSON.parse(saved))
      setProblem(null)
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e))
    }
  }
  return (
    <div className="grid h-full min-h-[720px] w-full grid-rows-[1fr_auto]">
      <div className="relative">
        <StateDiagram config={config} onConfigChange={setConfig} editable simulate />
      </div>
      <div className="flex flex-col gap-2 border-t border-border p-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setSaved(JSON.stringify(config, null, 2))}>Save as JSON</Button>
          <Button variant="secondary" size="sm" disabled={!saved} onClick={load}>Load it</Button>
          <Button variant="secondary" size="sm" onClick={() => setConfig(DOOR)}>Start again</Button>
        </div>
        <Textarea aria-label="The config, as JSON" rows={3} className="font-mono text-footnote" value={saved} onValueChange={(value) => setSaved(value)} />
        {problem ? <div role="alert" className="text-footnote text-destructive">{problem}</div> : null}
      </div>
    </div>
  )
}
