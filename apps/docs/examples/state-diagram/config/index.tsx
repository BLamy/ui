import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StateDiagram } from '@/components/ui/state-diagram'

const GOOD = {
  id: 'door',
  initial: 'closed',
  states: {
    closed: { on: { OPEN: 'open', LOCK: { guard: 'hasKey', target: 'locked' } } },
    open: { on: { CLOSE: 'closed' }, after: { 5000: 'closed' } },
    locked: { on: { UNLOCK: 'closed' } },
  },
}

const BAD = { id: 'door', initial: 'closed', states: { closed: { on: { OPEN: 'nowhere' } } } }

// A config's only data, and XState reads it. If XState won't have it, that's what you see.
export default function Config() {
  const [config, setConfig] = useState<Record<string, unknown>>(GOOD)
  return (
    <div className="grid h-full min-h-[420px] w-full grid-rows-[1fr_auto]">
      <div className="relative"><StateDiagram config={config} /></div>
      <div className="flex gap-2 border-t border-border p-3">
        <Button variant="secondary" onPress={() => setConfig(GOOD)}>A good one</Button>
        <Button variant="secondary" onPress={() => setConfig(BAD)}>One XState won’t have</Button>
      </div>
    </div>
  )
}
