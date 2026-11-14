import { useState } from 'react'
import { AnimatedHeight } from '@/components/ui/animated-height'
import { Button } from '@/components/ui/button'
import { Swap } from '@/components/ui/swap'
import { useDirection } from '@/lib/motion'

const steps = [
  { title: 'Send', body: 'Choose who to pay.' },
  { title: 'Amount', body: 'Enter an amount. Fees are shown before you confirm anything at all.' },
  { title: 'Review', body: 'To Wei Chen · $120.00. Arrives in about a minute. Nothing leaves your wallet until you confirm.' },
]

// Forward slides in from the right, Back from the left; AnimatedHeight springs
// the card to each step's height.
export default function Slide() {
  const [step, setStep] = useState(0)
  const dir = useDirection(step)
  return (
    <div className="mx-auto grid w-full max-w-sm gap-3">
      <AnimatedHeight className="rounded-card bg-card shadow-hairline">
        <Swap value={step} direction={dir} className="p-4">
          <div className="text-title font-semibold text-foreground">{steps[step].title}</div>
          <p className="m-0 mt-1 text-subhead text-muted-foreground">{steps[step].body}</p>
        </Swap>
      </AnimatedHeight>
      <div className="flex gap-2">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</Button>
        <Button className="flex-1" disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>Continue</Button>
      </div>
    </div>
  )
}
