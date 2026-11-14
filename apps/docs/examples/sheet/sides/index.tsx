import { useState } from 'react'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Listbox, ListboxItem } from '@/components/ui/list-box'
import {
  Sheet,
  SheetBackdrop,
  SheetBody,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Switch } from '@/components/ui/switch'
import { BLProvider } from '@/lib/theme'

const sides = ['bottom', 'right', 'left', 'top'] as const

// `side` picks the edge: bottom is the iOS card sheet with a grabber, left and
// right are side panels, top drops down. Each follows a drag toward its edge
// and springs away past a threshold. The sheet stays inside BLProvider — here
// a frame — so open each one and press Esc, the scrim or Apply.
export default function Sides() {
  const [unread, setUnread] = useState(false)
  const [applied, setApplied] = useState('No filters applied')
  return (
    <div className="mx-auto h-[420px] max-w-xl overflow-hidden rounded-card shadow-hairline">
      <BLProvider>
        <div className="grid h-full content-start gap-4 p-5">
          <div className="flex flex-wrap gap-3">
            {sides.map((side) => (
              <Sheet key={side} side={side}>
                <SheetTrigger className={cn(buttonVariants({ variant: 'secondary' }), 'capitalize')}>{side}</SheetTrigger>
                <SheetBackdrop />
                <SheetContent>
                  <SheetClose />
                  <SheetHeader>
                    <SheetTitle>Filters</SheetTitle>
                    <SheetDescription>Narrow the list of messages.</SheetDescription>
                  </SheetHeader>
                  <SheetBody className="flex flex-col gap-3">
                    <Listbox aria-label="Mailbox" defaultValue="all" className="bg-muted">
                      <ListboxItem value="all">All mail</ListboxItem>
                      <ListboxItem value="flagged">Flagged</ListboxItem>
                      <ListboxItem value="drafts">Drafts</ListboxItem>
                    </Listbox>
                    <div className="flex items-center justify-between rounded-panel bg-muted px-4 py-2 text-body">
                      Unread only
                      <Switch checked={unread} onCheckedChange={setUnread} aria-label="Unread only" />
                    </div>
                  </SheetBody>
                  <SheetFooter>
                    <SheetClose
                      render={<Button size="pill" />}
                      action={() => setApplied(`Applied from the ${side} sheet${unread ? ' · unread only' : ''}`)}
                    >
                      Apply
                    </SheetClose>
                  </SheetFooter>
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
