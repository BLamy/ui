import { useState } from 'react'
import type { Selection } from 'react-aria-components'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSection,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { ThemeScope } from '@/lib/theme'

// `selectionMode` on the menu turns rows into radio (single) or check
// (multiple) items, with the checkmark on the leading edge. Sections each get
// their own selection, so a sort order and a set of filters live in one menu.
export default function Selectable() {
  const [sort, setSort] = useState<Selection>(new Set(['date']))
  const [show, setShow] = useState<Selection>(new Set(['photos', 'videos']))
  const order = [...(sort === 'all' ? [] : sort)][0]
  const shown = show === 'all' ? 'everything' : [...show].join(', ') || 'nothing'
  // The ThemeScope is only here so the portalled overlay wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm justify-items-start gap-4">
      <DropdownMenu>
        <Button variant="secondary">View options</Button>
        <DropdownMenuContent aria-label="View options">
          <DropdownMenuSection
            title="Sort by"
            selectionMode="single"
            selectedKeys={sort}
            onSelectionChange={(keys) => keys !== 'all' && keys.size > 0 && setSort(keys)}
          >
            <DropdownMenuItem id="name">Name</DropdownMenuItem>
            <DropdownMenuItem id="date">Date modified</DropdownMenuItem>
            <DropdownMenuItem id="size">Size</DropdownMenuItem>
          </DropdownMenuSection>
          <DropdownMenuSeparator />
          <DropdownMenuSection
            title="Show"
            selectionMode="multiple"
            selectedKeys={show}
            onSelectionChange={setShow}
          >
            <DropdownMenuItem id="photos">Photos</DropdownMenuItem>
            <DropdownMenuItem id="videos">Videos</DropdownMenuItem>
            <DropdownMenuItem id="screenshots">Screenshots</DropdownMenuItem>
          </DropdownMenuSection>
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="m-0 text-footnote text-muted-foreground">
        Sorted by <strong>{String(order)}</strong> · showing {shown}
      </p>
    </ThemeScope>
  )
}
