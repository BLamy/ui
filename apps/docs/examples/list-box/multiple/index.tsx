import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Listbox, ListboxItem } from '@/components/ui/list-box'
import { Icon } from '@/lib/icon'

const people = [
  { id: 'ana', name: 'Ana Torres', email: 'ana@northwind.dev' },
  { id: 'kim', name: 'Kim Park', email: 'kim@northwind.dev' },
  { id: 'lee', name: 'Lee Chen', email: 'lee@northwind.dev' },
  { id: 'maya', name: 'Maya Okafor', email: 'maya@northwind.dev' },
]

// Multiple selection with a leading `icon` and a `description` line. The same
// parts with `variant="popup"` are the compact, left-checked list that Select
// and Combobox draw in their popups.
export default function Multiple() {
  const [selected, setSelected] = useState<string[]>(['ana', 'kim'])
  return (
    <div className="mx-auto grid max-w-sm gap-4">
      <div className="flex items-center gap-2">
        <strong className="flex-1 text-body">Share with</strong>
        <Badge variant="tinted">{selected.length} selected</Badge>
      </div>
      <Listbox aria-label="Share with" multiple value={selected} onValueChange={setSelected}>
        {people.map((p) => (
          <ListboxItem
            key={p.id}
            value={p.id}
            label={p.name}
            icon={<Icon name="person" size={26} />}
            description={p.email}
          >
            {p.name}
          </ListboxItem>
        ))}
      </Listbox>

      <Listbox
        aria-label="Filter (popup variant)"
        variant="popup"
        multiple
        defaultValue={['open']}
        className="rounded-panel bg-card"
      >
        <ListboxItem value="open">Open</ListboxItem>
        <ListboxItem value="closed">Closed</ListboxItem>
        <ListboxItem value="draft">Drafts</ListboxItem>
      </Listbox>
    </div>
  )
}
