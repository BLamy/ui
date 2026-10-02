import { useState } from 'react'
import type { Key } from 'react-aria-components'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from '@/components/ui/context-menu'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

const PHOTOS = ['Lisbon', 'Porto', 'Sintra']

// Each tile is its own ContextMenu: right-click it (or long-press on a touch
// screen, or focus it and press the menu key / Shift+F10) and the menu opens at
// the pointer. Choices arrive through `onAction` — the line below is the latest.
export default function Actions() {
  const [last, setLast] = useState('Nothing chosen yet')
  const [starred, setStarred] = useState<string[]>([])
  const act = (photo: string) => (key: Key) => {
    if (key === 'star') setStarred((s) => (s.includes(photo) ? s.filter((p) => p !== photo) : [...s, photo]))
    setLast(`${String(key)} · ${photo}`)
  }
  // The ThemeScope is only here so the portalled overlay wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-md gap-3">
      <div className="grid grid-cols-3 gap-3">
        {PHOTOS.map((photo) => (
          <ContextMenu key={photo} className="rounded-xl">
            <button
              type="button"
              className="grid aspect-square w-full cursor-pointer place-items-center rounded-xl border-0 bg-muted text-body text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {starred.includes(photo) ? '★ ' : ''}
              {photo}
            </button>
            <ContextMenuContent aria-label={`${photo} actions`} onAction={act(photo)}>
              <ContextMenuItem id="copy" icon={<Icon name="copy" size={20} />}>
                Copy
              </ContextMenuItem>
              <ContextMenuItem id="star" icon={<Icon name="star" size={20} />} shortcut={<ContextMenuShortcut>⌘D</ContextMenuShortcut>}>
                {starred.includes(photo) ? 'Remove favorite' : 'Favorite'}
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem id="delete" variant="destructive" icon={<Icon name="trash" size={20} />}>
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        ))}
      </div>
      <p className="m-0 text-footnote text-muted-foreground">{last}</p>
    </ThemeScope>
  )
}
