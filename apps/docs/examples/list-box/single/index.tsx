import { useState } from 'react'
import type { Selection } from 'react-aria-components'
import { ListBox, ListBoxItem } from '@/components/ui/list-box'

const tones = ['Reflection', 'Apex', 'Beacon', 'Bulletin', 'Chimes']

// The default `inset` variant: an inset-grouped list with a trailing check.
// Arrow keys move, typing jumps to a row, Space / Enter / click selects.
export default function Single() {
  const [selected, setSelected] = useState<Selection>(new Set(['Reflection']))
  const key = selected === 'all' ? 'all' : [...selected][0]
  return (
    <div className="mx-auto grid max-w-sm gap-3">
      <ListBox
        aria-label="Ringtone"
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={selected}
        onSelectionChange={setSelected}
      >
        {tones.map((t) => <ListBoxItem key={t} id={t}>{t}</ListBoxItem>)}
        <ListBoxItem id="Circuit" isDisabled description="Not available on this device">
          Circuit
        </ListBoxItem>
      </ListBox>
      <p className="m-0 px-1 text-footnote text-muted-foreground">Ringtone: {String(key)}</p>
    </div>
  )
}
