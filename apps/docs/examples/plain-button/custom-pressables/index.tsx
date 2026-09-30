import { useState } from 'react'
import { PlainButton, PlainToggleButton } from '@/components/ui/plain-button'
import { cn } from '@/lib/utils'

const FILTERS = ['Inbox', 'Unread', 'Flagged', 'Attachments']

// PlainButton brings react-aria's press, focus and data-* states and nothing
// else, so the look is entirely yours. Here: a chip that toggles, and a
// tappable row that reports its own press.
export default function CustomPressables() {
  const [selected, setSelected] = useState<Set<string>>(new Set(['Unread']))
  const [opened, setOpened] = useState(0)

  return (
    <div className="mx-auto grid max-w-md gap-5">
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((name) => (
          <PlainToggleButton
            key={name}
            isSelected={selected.has(name)}
            onChange={(on) =>
              setSelected((prev) => {
                const next = new Set(prev)
                if (on) next.add(name)
                else next.delete(name)
                return next
              })
            }
            className={cn(
              'h-8 cursor-pointer rounded-full border-0 px-3.5 text-subhead font-medium outline-none transition-colors',
              'bg-secondary text-secondary-foreground data-pressed:bg-secondary-strong',
              'data-selected:bg-primary data-selected:text-primary-foreground',
              'data-focus-visible:ring-2 data-focus-visible:ring-ring data-focus-visible:ring-offset-2',
            )}
          >
            {name}
          </PlainToggleButton>
        ))}
      </div>

      <PlainButton
        title="Open the thread"
        onPress={() => setOpened((n) => n + 1)}
        className="flex h-row cursor-pointer items-center justify-between rounded-card border-0 bg-card px-4 text-left text-body text-foreground shadow-hairline outline-none data-pressed:bg-secondary data-focus-visible:ring-2 data-focus-visible:ring-ring"
      >
        <span>Design review, Thursday</span>
        <span className="text-subhead text-muted-foreground">Opened {opened}×</span>
      </PlainButton>
    </div>
  )
}
