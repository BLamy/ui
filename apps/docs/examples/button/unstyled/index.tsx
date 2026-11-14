import { useState } from 'react'
import { Button as SdkButton } from '@ui-sdk/react/button'
import { Toggle as SdkToggle } from '@ui-sdk/react/toggle'
import { cn } from '@/lib/utils'

const FILTERS = ['Inbox', 'Unread', 'Flagged', 'Attachments']

// UI SDK's Button and Toggle bring press, focus and data-* states and nothing
// else, so the look is entirely yours. Here: a chip that toggles, and a
// tappable row that reports its own press.
export default function CustomPressables() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['Unread']))
  const [opened, setOpened] = useState(0)

  return (
    <div className="mx-auto grid max-w-md gap-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((name) => (
          <SdkToggle
            key={name}
            pressed={selected.has(name)}
            onPressedChange={(on: boolean) =>
              setSelected((prev) => {
                const next = new Set(prev)
                if (on) next.add(name)
                else next.delete(name)
                return next
              })
            }
            className={cn(
              'h-8 cursor-pointer rounded-full border-0 px-3.5 text-subhead font-medium outline-none transition-colors',
              'bg-secondary text-secondary-foreground active:not-data-pressed:bg-secondary-strong',
              'data-pressed:bg-primary data-pressed:text-primary-foreground',
              'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
          >
            {name}
          </SdkToggle>
        ))}
      </div>

      <SdkButton
        title="Open the thread"
        onClick={() => setOpened((n) => n + 1)}
        className="flex h-row cursor-pointer items-center justify-between rounded-card border-0 bg-card px-4 text-left text-body text-foreground shadow-hairline outline-none active:bg-secondary focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span>Design review, Thursday</span>
        <span className="text-subhead text-muted-foreground">Opened {opened}×</span>
      </SdkButton>
    </div>
  )
}
