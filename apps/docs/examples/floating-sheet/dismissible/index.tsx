import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FloatingSheet } from '@/components/ui/floating-sheet'

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

// A docked bottom sheet you can put away, like the Maps or Find My sheet.
// `peek` and `detents` are shares of the host's height; dragging below the
// resting height slides the sheet off the edge and calls `onDismiss`.
export default function Dismissible() {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative mx-auto h-[480px] max-w-sm overflow-hidden rounded-card bg-muted shadow-hairline">
      <div className="grid h-full place-content-center justify-items-center gap-3">
        <p className="m-0 text-subhead text-muted-foreground">Map goes here</p>
        <Button onPress={() => setVisible(true)}>Nearby places</Button>
      </div>
      <FloatingSheet
        appearance="sheet"
        gutter={0}
        radius={16}
        dismissible
        visible={visible}
        onDismiss={() => setVisible(false)}
        peek="40%"
        detents={['70%']}
        topGap="5%"
        hideOnScroll={false}
        label="Nearby places"
      >
        {/* One child: the body stretches each direct child to its full height. */}
        <FloatingSheet.Body>
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex items-center justify-between px-5 pb-2">
              <h2 className="m-0 text-title font-bold">Nearby</h2>
              <Button size="sm" variant="ghost" onPress={() => setVisible(false)}>
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
          </div>
        </FloatingSheet.Body>
      </FloatingSheet>
    </div>
  )
}
