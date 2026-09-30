import { useState } from 'react'
import type { Selection } from 'react-aria-components'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

// `selectionMode="single"` (the default) behaves like radio buttons — and in
// the `filled` variant one card slides between the items. `"multiple"` lets
// each item toggle on its own. Arrow keys move focus between items.
export default function Modes() {
  const [view, setView] = useState<Selection>(new Set(['grid']))
  const [marks, setMarks] = useState<Selection>(new Set(['bold']))
  return (
    <div className="mx-auto grid max-w-sm justify-items-start gap-5">
      <ToggleGroup variant="filled" aria-label="View" selectedKeys={view} onSelectionChange={setView} disallowEmptySelection>
        <ToggleGroupItem id="list">List</ToggleGroupItem>
        <ToggleGroupItem id="grid">Grid</ToggleGroupItem>
        <ToggleGroupItem id="board">Board</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup variant="outline" selectionMode="multiple" aria-label="Text style" selectedKeys={marks} onSelectionChange={setMarks}>
        <ToggleGroupItem id="bold" aria-label="Bold" className="font-bold">B</ToggleGroupItem>
        <ToggleGroupItem id="italic" aria-label="Italic" className="italic">I</ToggleGroupItem>
        <ToggleGroupItem id="underline" aria-label="Underline" className="underline">U</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup size="sm" selectionMode="multiple" aria-label="Days" defaultSelectedKeys={['mon', 'wed']}>
        {['mon', 'tue', 'wed', 'thu', 'fri'].map((d) => (
          <ToggleGroupItem key={d} id={d} className="capitalize">{d}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="m-0 text-footnote text-muted-foreground">
        View: {[...(view as Set<string>)].join(', ') || 'none'} · Style: {[...(marks as Set<string>)].join(', ') || 'none'}
      </p>
    </div>
  )
}
