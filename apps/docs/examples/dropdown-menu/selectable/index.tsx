import { useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeScope } from '@/lib/theme'

const KINDS = [
  { value: 'photos', label: 'Photos' },
  { value: 'videos', label: 'Videos' },
  { value: 'screenshots', label: 'Screenshots' },
]

// A radio group holds one value (the sort order); checkbox items toggle on
// their own (the filters). Both keep the menu open and show a leading
// checkmark, and every row of a group keeps the checkmark's column.
export default function Selectable() {
  const [sort, setSort] = useState('date')
  const [show, setShow] = useState<string[]>(['photos', 'videos'])
  const toggle = (value: string, on: boolean) =>
    setShow((s) => (on ? [...s, value] : s.filter((v) => v !== value)))
  const shown = KINDS.filter((k) => show.includes(k.value)).map((k) => k.label.toLowerCase()).join(', ') || 'nothing'
  // The ThemeScope is only here so the overlay wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm justify-items-start gap-4">
      <DropdownMenu>
        <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary' })}>View options</DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuRadioGroup value={sort} onValueChange={setSort}>
            <DropdownMenuGroupLabel>Sort by</DropdownMenuGroupLabel>
            <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="date">Date modified</DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="size">Size</DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuGroupLabel>Show</DropdownMenuGroupLabel>
            {KINDS.map((kind) => (
              <DropdownMenuCheckboxItem
                key={kind.value}
                value={kind.value}
                checked={show.includes(kind.value)}
                onCheckedChange={(on) => toggle(kind.value, on)}
              >
                {kind.label}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="m-0 text-footnote text-muted-foreground">
        Sorted by <strong>{sort}</strong> · showing {shown}
      </p>
    </ThemeScope>
  )
}
