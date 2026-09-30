import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Celebrate } from '@/components/ui/celebrate'
import { Progress } from '@/components/ui/progress'
import { Icon } from '@/lib/icon'

// Celebrate goes inside a `relative isolate` wrapper, next to the thing that
// succeeded. Each time `fire` changes (here a counter) a ring pulses and
// confetti falls away behind the badge. Rare moments earn it; this is one.
export default function Backup() {
  const [running, setRunning] = useState(false)
  const [value, setValue] = useState(0)
  const [fired, setFired] = useState(0)

  useEffect(() => {
    if (!running) return
    const t = setInterval(() => {
      setValue((v) => {
        if (v >= 100) return v
        const next = Math.min(100, v + 8)
        if (next === 100) {
          setRunning(false)
          setFired((n) => n + 1)
        }
        return next
      })
    }, 260)
    return () => clearInterval(t)
  }, [running])

  const done = value === 100
  return (
    <div className="mx-auto grid w-full max-w-sm justify-items-center gap-12 py-8">
      <div className="relative isolate">
        <Celebrate fire={fired} />
        <div
          className={
            'grid size-16 place-items-center rounded-full transition-colors duration-spring-smooth ' +
            (done ? 'bg-success text-white' : 'bg-secondary text-muted-foreground')
          }
        >
          <Icon name={done ? 'check' : 'cloud'} size={30} sw={2.4} />
        </div>
      </div>
      <Progress
        aria-label="Backup progress"
        value={value}
        tone={done ? 'success' : 'default'}
        size="sm"
      />
      <div className="flex gap-2">
        <Button
          isDisabled={running}
          onPress={() => {
            setValue(0)
            setRunning(true)
          }}
        >
          {done ? 'Back up again' : 'Back up now'}
        </Button>
        <Button variant="secondary" onPress={() => setFired((n) => n + 1)}>
          Replay burst
        </Button>
      </div>
    </div>
  )
}
