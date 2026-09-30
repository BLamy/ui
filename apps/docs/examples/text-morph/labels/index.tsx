import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TextMorph } from '@/components/ui/text-morph'

const flow = ['Continue', 'Confirm', 'Confirmed', 'Done']
const tabs = ['Overview', 'Over budget', 'Activity']

// TextMorph is the same trick the Button uses for plain-text children: letters
// the two labels share slide to their new places, the rest blur out and in.
export default function Labels() {
  const [step, setStep] = useState(0)
  const [tab, setTab] = useState(0)
  return (
    <div className="mx-auto grid max-w-sm justify-items-center gap-8">
      <div className="grid justify-items-center gap-3">
        <p className="text-title font-semibold">
          <TextMorph>{flow[step]}</TextMorph>
        </p>
        <Button onPress={() => setStep((s) => (s + 1) % flow.length)}>
          Next label
        </Button>
      </div>
      <div className="grid justify-items-center gap-3">
        <p className="text-caption2 text-muted-foreground">
          A Button morphs its own label, no wrapper needed
        </p>
        <Button
          variant="secondary"
          onPress={() => setTab((t) => (t + 1) % tabs.length)}
        >
          {tabs[tab]}
        </Button>
      </div>
    </div>
  )
}
