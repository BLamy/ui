import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

type Phase = 'idle' | 'queued' | 'uploading' | 'done'

// Controlled progress: indeterminate while the request is queued, then a
// determinate fill that springs to each new value, then the success tone.
export default function Upload() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (phase === 'queued') {
      const t = setTimeout(() => setPhase('uploading'), 1200)
      return () => clearTimeout(t)
    }
    if (phase === 'uploading') {
      const t = setInterval(() => {
        setValue((v) => {
          const next = Math.min(100, v + 6 + Math.round(Math.random() * 10))
          if (next === 100) setPhase('done')
          return next
        })
      }, 450)
      return () => clearInterval(t)
    }
    return undefined
  }, [phase])

  const start = () => {
    setValue(0)
    setPhase('queued')
  }
  const label =
    phase === 'queued'
      ? 'Waiting for the server…'
      : phase === 'done'
        ? 'Upload complete'
        : 'Uploading IMG_2841.mov'

  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      {phase === 'idle' ? (
        <p className="text-subhead text-muted-foreground">
          Nothing uploading. Start an upload to see the bar.
        </p>
      ) : (
        <Progress
          label={label}
          showValue={phase !== 'queued'}
          isIndeterminate={phase === 'queued'}
          value={value}
          tone={phase === 'done' ? 'success' : 'default'}
        />
      )}
      <Button
        variant="secondary"
        isDisabled={phase === 'queued' || phase === 'uploading'}
        onPress={start}
        className="justify-self-start"
      >
        {phase === 'done' ? 'Upload again' : 'Start upload'}
      </Button>
    </div>
  )
}
