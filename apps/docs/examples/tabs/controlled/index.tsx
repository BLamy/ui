import { useState } from 'react'
import type { Key } from 'react-aria-components'
import { Button } from '@/components/ui/button'
import { Tab, TabList, TabPanel, Tabs } from '@/components/ui/tabs'

const steps = [
  { id: 'plan', title: 'Plan', body: 'Pick the weekly goals. Keep it to three.' },
  { id: 'build', title: 'Build', body: 'Heads down. Notifications are paused until 3 PM.' },
  { id: 'review', title: 'Review', body: 'Walk through what shipped and what slipped.' },
]

// `selectedKey` + `onSelectionChange` make the tabs controlled, so a button
// elsewhere can move them. A panel slides in from the side of the tab that
// was chosen: go forward and it comes from the right, back and from the left.
export default function Controlled() {
  const [key, setKey] = useState<Key>('plan')
  const index = steps.findIndex((s) => s.id === key)
  return (
    <div className="mx-auto grid max-w-lg gap-4">
      <Tabs variant="underline" selectedKey={key} onSelectionChange={setKey}>
        <TabList aria-label="Week">
          {steps.map((s) => (
            <Tab key={s.id} id={s.id}>
              {s.title}
            </Tab>
          ))}
        </TabList>
        {steps.map((s) => (
          <TabPanel
            key={s.id}
            id={s.id}
            className="rounded-card bg-card p-4 text-subhead text-muted-foreground"
          >
            {s.body}
          </TabPanel>
        ))}
      </Tabs>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          isDisabled={index === 0}
          onPress={() => setKey(steps[index - 1].id)}
        >
          Back
        </Button>
        <Button
          size="sm"
          isDisabled={index === steps.length - 1}
          onPress={() => setKey(steps[index + 1].id)}
        >
          Next
        </Button>
      </div>
    </div>
  )
}
