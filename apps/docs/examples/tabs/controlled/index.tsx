import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'

const steps = [
  { id: 'plan', title: 'Plan', body: 'Pick the weekly goals. Keep it to three.' },
  { id: 'build', title: 'Build', body: 'Heads down. Notifications are paused until 3 PM.' },
  { id: 'review', title: 'Review', body: 'Walk through what shipped and what slipped.' },
]

// `value` + `onValueChange` make the tabs controlled, so a button elsewhere
// can move them. A panel slides in from the side of the tab that was chosen:
// go forward and it comes from the right, back and from the left.
export default function Controlled() {
  const [step, setStep] = useState<string | null>('plan')
  const index = steps.findIndex((s) => s.id === step)
  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <Tabs variant="underline" value={step} onValueChange={setStep}>
        <TabsList aria-label="Week">
          {steps.map((s) => (
            <TabsTab key={s.id} value={s.id}>
              {s.title}
            </TabsTab>
          ))}
        </TabsList>
        {steps.map((s) => (
          <TabsPanel
            key={s.id}
            value={s.id}
            className="rounded-card bg-card p-4 text-subhead text-muted-foreground"
          >
            {s.body}
          </TabsPanel>
        ))}
      </Tabs>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={index === 0}
          onClick={() => setStep(steps[index - 1].id)}
        >
          Back
        </Button>
        <Button
          size="sm"
          disabled={index === steps.length - 1}
          onClick={() => setStep(steps[index + 1].id)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
