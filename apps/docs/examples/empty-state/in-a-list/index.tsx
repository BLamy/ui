import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Icon } from '@/lib/icon'

const ITEMS = ['Buy milk', 'Call the plumber', 'Book flights']

// A list that can run out: when it does, the empty state takes the list's place
// with an action that puts something back. `role="status"` announces it.
export default function InAList() {
  const [items, setItems] = useState(ITEMS)
  return (
    <Card className="mx-auto h-64 max-w-sm">
      {items.length ? (
        <ul className="m-0 list-none p-0">
          {items.map((item) => (
            <li key={item} className="flex h-row items-center justify-between gap-2 px-4 text-body text-foreground shadow-hairline-b">
              {item}
              <Button size="sm" variant="quiet" onClick={() => setItems((all) => all.filter((x) => x !== item))}>
                Done
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          role="status"
          icon={<Icon name="checklist" />}
          title="All done"
          description="Nothing left on today's list."
          action={<Button size="sm" variant="secondary" onClick={() => setItems(ITEMS)}>Start over</Button>}
        />
      )}
    </Card>
  )
}
