import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SnapSheet } from '@/components/ui/snap-sheet'

const places = [
  ['Blue Bottle Coffee', 'Coffee · 0.2 mi'],
  ['Ferry Building Marketplace', 'Food hall · 0.6 mi'],
  ['Dolores Park', 'Park · 1.4 mi'],
  ['Exploratorium', 'Museum · 0.9 mi'],
  ['Tartine Bakery', 'Bakery · 1.6 mi'],
  ['Twin Peaks', 'Viewpoint · 3.1 mi'],
  ['Palace of Fine Arts', 'Landmark · 2.8 mi'],
  ['Lands End', 'Trail · 6.2 mi'],
]

// SnapSheet fills its nearest positioned ancestor (it is `absolute inset-0`),
// so put it inside a `relative` frame. `snaps` are fractions of that frame's
// height; it rises to the first one. Drag the handle up or down, flick it, or
// drag below the lowest snap (or press the scrim) to close.
export default function Basic() {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative mx-auto h-[480px] max-w-sm overflow-hidden rounded-card bg-muted shadow-hairline">
      <div className="grid h-full place-content-center justify-items-center gap-3">
        <p className="m-0 text-subhead text-muted-foreground">Map goes here</p>
        <Button onPress={() => setOpen(true)}>Nearby places</Button>
      </div>
      <SnapSheet open={open} onClose={() => setOpen(false)} snaps={[0.4, 0.7, 0.95]}>
        <div className="flex items-center justify-between px-5 pb-2">
          <h2 className="m-0 text-title font-bold">Nearby</h2>
          <Button size="sm" variant="ghost" onPress={() => setOpen(false)}>
            Done
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {places.map(([name, kind]) => (
            <div key={name} className="px-5 py-3 shadow-hairline-b">
              <div className="text-body">{name}</div>
              <div className="text-footnote text-muted-foreground">{kind}</div>
            </div>
          ))}
        </div>
      </SnapSheet>
    </div>
  )
}
