import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DisclosureGroup,
  DisclosureGroupHeader,
  DisclosureGroupItem,
  DisclosureGroupPanel,
  DisclosureGroupTrigger,
} from '@/components/ui/disclosure'

const sections = [
  {
    id: 'notifications',
    title: 'Notifications',
    body: 'Mentions and direct messages always notify. Channel activity is batched into one digest at 9:00.',
  },
  {
    id: 'privacy',
    title: 'Privacy',
    body: 'Your status and last-seen time are visible to people in the same workspace, never to guests.',
  },
  {
    id: 'storage',
    title: 'Storage',
    body: '41 GB of 50 GB used. Attachments older than a year can be moved to cold storage from here.',
  },
]

const ids = sections.map((s) => s.id)

// The inset variant is an iOS grouped card. Several sections can be open
// (`multiple`), and `value` makes it controlled, so the buttons above can open
// or close all of them.
export default function Settings() {
  const [open, setOpen] = useState(['privacy'])
  return (
    <div className="mx-auto grid max-w-lg gap-3 rounded-card bg-muted p-4">
      <div className="flex items-center gap-2">
        <span className="flex-1 text-footnote text-muted-foreground">
          {open.length} of {ids.length} open
        </span>
        <Button size="sm" variant="secondary" onClick={() => setOpen(ids)}>
          Expand all
        </Button>
        <Button size="sm" variant="secondary" onClick={() => setOpen([])}>
          Collapse all
        </Button>
      </div>
      <DisclosureGroup variant="inset" multiple value={open} onValueChange={setOpen}>
        {sections.map((s) => (
          <DisclosureGroupItem key={s.id} value={s.id}>
            <DisclosureGroupHeader>
              <DisclosureGroupTrigger>{s.title}</DisclosureGroupTrigger>
            </DisclosureGroupHeader>
            <DisclosureGroupPanel>{s.body}</DisclosureGroupPanel>
          </DisclosureGroupItem>
        ))}
      </DisclosureGroup>
    </div>
  )
}
