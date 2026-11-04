import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { StateDiagram } from '@/components/ui/state-diagram'

const CONFIGS: Record<string, Record<string, unknown>> = {
  // Nobody's written `fetchThings`. It waits, and you say how it finished.
  'An invoke with nothing behind it': {
    id: 'loader',
    initial: 'idle',
    states: {
      idle: { on: { LOAD: 'loading' } },
      loading: { invoke: { src: 'fetchThings', onDone: 'loaded', onError: 'failed' } },
      loaded: { type: 'final' },
      failed: { on: { LOAD: 'loading' } },
    },
  },
  // This would hang the page if it ran for real.
  'One that never settles': {
    id: 'spin',
    initial: 'still',
    states: {
      still: { on: { GO: 'tick' } },
      tick: { always: 'tock' },
      tock: { always: 'tick' },
    },
  },
  // And this, once its timers are allowed to run.
  'One that goes round on timers': {
    id: 'blink',
    initial: 'on',
    states: {
      on: { after: { 0: 'off' } },
      off: { after: { 0: 'on' } },
    },
  },
  // A second, so that running time can be watched.
  'One with a short timer': {
    id: 'light',
    initial: 'green',
    states: {
      green: { after: { 400: 'amber' } },
      amber: { after: { 400: 'red' } },
      red: { on: { RESET: 'green' } },
    },
  },
}

export default function Awkward() {
  const [name, setName] = useState(Object.keys(CONFIGS)[0])
  return (
    <div className="grid h-full min-h-[560px] w-full grid-rows-[auto_1fr]">
      <div className="flex flex-wrap gap-2 border-b border-border p-3">
        {Object.keys(CONFIGS).map((n) => (
          <Button key={n} variant={n === name ? 'ghost' : 'secondary'} size="sm" onPress={() => setName(n)}>{n}</Button>
        ))}
      </div>
      <div className="relative"><StateDiagram key={name} config={CONFIGS[name]} simulate /></div>
    </div>
  )
}
