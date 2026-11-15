import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'

type Step = 'continue' | 'confirm' | 'paying' | 'done'

const LABEL: Record<Step, string> = {
  continue: 'Continue',
  confirm: 'Confirm $48.00',
  paying: 'Paying…',
  done: 'Paid',
}

// A string child is wrapped in TextMorph, so each new label slides the shared
// letters and the button springs to its new width. Returning a Promise from
// `onClick` keeps the button pending (focused, ignoring presses) until it settles.
export default function LabelMorph() {
  const [step, setStep] = useState<Step>('continue')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const press = () => {
    if (step === 'continue') setStep('confirm')
    else if (step === 'confirm') {
      setStep('paying')
      return new Promise<void>((resolve) => {
        timer.current = setTimeout(() => {
          setStep('done')
          resolve()
        }, 1600)
      })
    }
    return undefined
  }

  return (
    <div className="mx-auto grid max-w-sm gap-4 rounded-card bg-card p-5 shadow-hairline">
      <div className="grid gap-1">
        <div className="text-body font-semibold">Pro plan, annual</div>
        <div className="text-subhead text-muted-foreground">
          {step === 'continue' ? 'Review your order, then continue.' : 'Charged to the card ending 4242.'}
        </div>
      </div>
      <div className="flex items-center justify-between gap-3">
        <Button
          variant={step === 'done' ? 'secondary' : 'default'}
          disabled={step === 'done'}
          onClick={press}
        >
          {LABEL[step]}
        </Button>
        <Button variant="plain" onClick={() => setStep('continue')}>
          Start over
        </Button>
      </div>
    </div>
  )
}
