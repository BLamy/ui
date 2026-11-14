import { useState } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle'

// One item pressed at a time by default — and in the `filled` variant one card
// slides between the items. `multiple` lets each item toggle on its own. The
// value is an array of the pressed items' values. Arrow keys move focus.
export default function Modes() {
  const [view, setView] = useState(['grid'])
  const [marks, setMarks] = useState(['bold'])
  return (
    <div className="mx-auto grid max-w-sm justify-items-start gap-5">
      <ToggleGroup variant="filled" aria-label="View" value={view} onValueChange={setView} deselectable={false}>
        <ToggleGroupItem value="list">List</ToggleGroupItem>
        <ToggleGroupItem value="grid">Grid</ToggleGroupItem>
        <ToggleGroupItem value="board">Board</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup variant="outline" multiple aria-label="Text style" value={marks} onValueChange={setMarks}>
        <ToggleGroupItem value="bold" aria-label="Bold" className="font-bold">B</ToggleGroupItem>
        <ToggleGroupItem value="italic" aria-label="Italic" className="italic">I</ToggleGroupItem>
        <ToggleGroupItem value="underline" aria-label="Underline" className="underline">U</ToggleGroupItem>
      </ToggleGroup>
      <ToggleGroup size="sm" multiple aria-label="Days" defaultValue={['mon', 'wed']}>
        {['mon', 'tue', 'wed', 'thu', 'fri'].map((d) => (
          <ToggleGroupItem key={d} value={d} className="capitalize">{d}</ToggleGroupItem>
        ))}
      </ToggleGroup>
      <p className="m-0 text-footnote text-muted-foreground">
        View: {view.join(', ') || 'none'} · Style: {marks.join(', ') || 'none'}
      </p>
    </div>
  )
}
