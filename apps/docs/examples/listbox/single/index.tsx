import { useState } from 'react'
import { Listbox, ListboxItem } from '@/components/ui/listbox'

const tones = ['Reflection', 'Apex', 'Beacon', 'Bulletin', 'Chimes']

// The default `inset` variant: an inset-grouped list with a trailing check.
// Arrow keys move and select, typing jumps to a row, a press selects.
export default function Single() {
  const [selected, setSelected] = useState<string | null>('Reflection')
  return (
    <div className="mx-auto grid max-w-sm gap-3">
      <Listbox aria-label="Ringtone" value={selected} onValueChange={setSelected}>
        {tones.map((t) => <ListboxItem key={t} value={t}>{t}</ListboxItem>)}
        <ListboxItem value="Circuit" disabled description="Not available on this device">
          Circuit
        </ListboxItem>
      </Listbox>
      <p className="m-0 px-1 text-footnote text-muted-foreground">Ringtone: {selected ?? 'none'}</p>
    </div>
  )
}
