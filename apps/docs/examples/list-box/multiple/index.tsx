import { useState } from 'react'
import type { Selection } from 'react-aria-components'
import { Badge } from '@/components/ui/badge'
import { ListBox, ListBoxItem } from '@/components/ui/list-box'
import { Icon } from '@/lib/icon'

const people = [
  { id: 'ana', name: 'Ana Torres', email: 'ana@northwind.dev' },
  { id: 'kim', name: 'Kim Park', email: 'kim@northwind.dev' },
  { id: 'lee', name: 'Lee Chen', email: 'lee@northwind.dev' },
  { id: 'maya', name: 'Maya Okafor', email: 'maya@northwind.dev' },
]

// Multiple selection with a leading `icon` and a `description` line. The same
// parts with `variant="popup"` are the compact, left-checked list that Select,
// ComboBox and DropdownMenu-style popovers use.
export default function Multiple() {
  const [selected, setSelected] = useState<Selection>(new Set(['ana', 'kim']))
  const count = selected === 'all' ? people.length : selected.size
  return (
    <div className="mx-auto grid max-w-sm gap-4">
      <div className="flex items-center gap-2">
        <strong className="flex-1 text-body">Share with</strong>
        <Badge variant="tinted">{count} selected</Badge>
      </div>
      <ListBox
        aria-label="Share with"
        selectionMode="multiple"
        selectedKeys={selected}
        onSelectionChange={setSelected}
      >
        {people.map((p) => (
          <ListBoxItem
            key={p.id}
            id={p.id}
            textValue={p.name}
            icon={<Icon name="person" size={26} />}
            description={p.email}
          >
            {p.name}
          </ListBoxItem>
        ))}
      </ListBox>

      <ListBox
        aria-label="Filter (popup variant)"
        variant="popup"
        selectionMode="multiple"
        defaultSelectedKeys={['open']}
        className="rounded-panel bg-card"
      >
        <ListBoxItem id="open">Open</ListBoxItem>
        <ListBoxItem id="closed">Closed</ListBoxItem>
        <ListBoxItem id="draft">Drafts</ListBoxItem>
      </ListBox>
    </div>
  )
}
