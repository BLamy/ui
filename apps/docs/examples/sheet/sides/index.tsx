import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ListBox, ListBoxItem } from '@/components/ui/list-box'
import {
  Sheet,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { BLProvider } from '@/lib/theme'

const sides = ['bottom', 'right', 'left', 'top'] as const

// `side` picks the edge: bottom is the iOS card sheet with a grabber, left and
// right are side panels, top drops down. The sheet fills BLProvider — here a
// frame — so open each one and press Esc, the scrim or Apply.
export default function Sides() {
  const [unread, setUnread] = useState(false)
  const [applied, setApplied] = useState('No filters applied')
  return (
    <div className="mx-auto h-[420px] max-w-xl overflow-hidden rounded-card shadow-hairline">
      <BLProvider>
        <div className="grid h-full content-start gap-4 p-5">
          <div className="flex flex-wrap gap-3">
            {sides.map((side) => (
              <Sheet key={side}>
                <Button variant="secondary" className="capitalize">{side}</Button>
                <SheetContent side={side} aria-label="Filters">
                  {({ close }) => (
                    <>
                      <SheetClose />
                      <SheetHeader>
                        <SheetTitle>Filters</SheetTitle>
                        <SheetDescription>Narrow the list of messages.</SheetDescription>
                      </SheetHeader>
                      <SheetBody className="flex flex-col gap-3">
                        <ListBox
                          aria-label="Mailbox"
                          selectionMode="single"
                          defaultSelectedKeys={['all']}
                          disallowEmptySelection
                          className="bg-muted"
                        >
                          <ListBoxItem id="all">All mail</ListBoxItem>
                          <ListBoxItem id="flagged">Flagged</ListBoxItem>
                          <ListBoxItem id="drafts">Drafts</ListBoxItem>
                        </ListBox>
                        <div className="flex items-center justify-between rounded-panel bg-muted px-4 py-2 text-body">
                          Unread only
                          <Switch checked={unread} onChange={setUnread} aria-label="Unread only" />
                        </div>
                      </SheetBody>
                      <SheetFooter>
                        <Button
                          size="pill"
                          onPress={() => {
                            setApplied(`Applied from the ${side} sheet${unread ? ' · unread only' : ''}`)
                            close()
                          }}
                        >
                          Apply
                        </Button>
                      </SheetFooter>
                    </>
                  )}
                </SheetContent>
              </Sheet>
            ))}
          </div>
          <p className="m-0 text-footnote text-muted-foreground" aria-live="polite">{applied}</p>
        </div>
      </BLProvider>
    </div>
  )
}
