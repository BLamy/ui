import { useState } from 'react'
import { AnimatedHeight } from '@/components/ui/animated-height'
import { Swap } from '@/components/ui/swap'
import { Button } from '@/components/ui/button'
import { useDirection } from '@/lib/motion'

const steps = [
  {
    title: 'Name your workspace',
    body: 'Pick something your team will recognise. You can rename it later.',
  },
  {
    title: 'Invite teammates',
    body: 'Paste email addresses, one per line, or share an invite link. Invitees join with the role you choose here, and you can change individual roles from the members page at any time.',
  },
  {
    title: 'You are all set',
    body: 'Your workspace is ready. Connect a repository to start your first project, or explore the sample project we created for you.',
  },
]

// The tray grows and shrinks to each step (AnimatedHeight) while the content
// slides in the direction of travel (Swap + useDirection).
export default function Steps() {
  const [index, setIndex] = useState(0)
  const dir = useDirection(index)
  const step = steps[index]
  return (
    <div className="mx-auto grid w-full max-w-sm gap-4">
      <AnimatedHeight className="rounded-card bg-card shadow-hairline">
        <Swap value={index} direction={dir}>
          <div className="grid gap-2 p-5">
            <div className="text-caption2 text-muted-foreground tabular-nums">
              Step {index + 1} of {steps.length}
            </div>
            <div className="text-body font-semibold">{step.title}</div>
            <p className="text-subhead text-muted-foreground">{step.body}</p>
          </div>
        </Swap>
      </AnimatedHeight>
      <div className="flex justify-between">
        <Button
          variant="secondary"
          disabled={index === 0}
          onClick={() => setIndex((i) => i - 1)}
        >
          Back
        </Button>
        <Button
          disabled={index === steps.length - 1}
          onClick={() => setIndex((i) => i + 1)}
        >
          Continue
        </Button>
      </div>
    </div>
  )
}
