import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useCountdown } from '@/components/ui/progress-ring'

// A 12 second countdown that starts 5 seconds in. `running` pauses it,
// `loop` restarts it at zero, `reset` goes back to the offset, and `onEnd`
// fires once per period that ended.
export default function Countdown() {
  const [running, setRunning] = useState(true)
  const [loop, setLoop] = useState(true)
  const [ends, setEnds] = useState(0)
  const { remaining, period, elapsed, reset } = useCountdown(12, {
    running,
    loop,
    offset: 5,
    onEnd: () => setEnds((n) => n + 1),
  })
  return (
    <div className="mx-auto grid max-w-sm gap-4">
      <div className="grid grid-cols-2 gap-2 rounded-card bg-card p-4 text-subhead text-foreground shadow-hairline tabular-nums">
        <span className="text-foreground">remaining</span>
        <span>{remaining}</span>
        <span className="text-foreground">period</span>
        <span>{period}</span>
        <span className="text-foreground">elapsed</span>
        <span>{elapsed}</span>
        <span className="text-foreground">onEnd calls</span>
        <span>{ends}</span>
      </div>
      <div className="flex items-center justify-between gap-4 rounded-card bg-card p-4 shadow-hairline">
        <span id="cd-running" className="text-body text-foreground">
          Running
        </span>
        <Switch aria-labelledby="cd-running" checked={running} onChange={setRunning} />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-card bg-card p-4 shadow-hairline">
        <span id="cd-loop" className="text-body text-foreground">
          Loop
        </span>
        <Switch aria-labelledby="cd-loop" checked={loop} onChange={setLoop} />
      </div>
      <Button
        variant="secondary"
        onPress={() => {
          reset()
          setEnds(0)
        }}
      >
        Reset
      </Button>
    </div>
  )
}
