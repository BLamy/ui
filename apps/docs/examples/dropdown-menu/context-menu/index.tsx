import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuContextTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

const PHOTOS = ['Lisbon', 'Porto', 'Sintra']

// Each tile is its own menu with a DropdownMenuContextTrigger: right-click it (or long-press on a touch
// screen, or focus it and press the menu key / Shift+F10) and the menu opens at
// the pointer. Choices arrive through `onAction` — the line below is the latest.
export default function Actions() {
  const [last, setLast] = useState('Nothing chosen yet')
  const [starred, setStarred] = useState<string[]>([])
  const act = (photo: string) => (value: string) => {
    if (value === 'star') setStarred((s) => (s.includes(photo) ? s.filter((p) => p !== photo) : [...s, photo]))
    setLast(`${value} · ${photo}`)
  }
  // The ThemeScope is only here so the overlay wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-md gap-3">
      <div className="grid grid-cols-3 gap-3">
        {PHOTOS.map((photo) => (
          <DropdownMenu key={photo} onAction={act(photo)}>
            <DropdownMenuContextTrigger className="rounded-xl">
              <button
                type="button"
                className="grid aspect-square w-full cursor-pointer place-items-center rounded-xl border-0 bg-muted font-[inherit] text-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {starred.includes(photo) ? '★ ' : ''}
                {photo}
              </button>
            </DropdownMenuContextTrigger>
            <DropdownMenuContent aria-label={`${photo} actions`}>
              <DropdownMenuItem value="copy" icon={<Icon name="copy" size={20} />}>
                Copy
              </DropdownMenuItem>
              <DropdownMenuItem value="star" icon={<Icon name="star" size={20} />} shortcut="mod+d">
                {starred.includes(photo) ? 'Remove favorite' : 'Favorite'}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem value="delete" destructive icon={<Icon name="trash" size={20} />}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ))}
      </div>
      <p className="m-0 text-footnote text-muted-foreground">{last}</p>
    </ThemeScope>
  )
}
