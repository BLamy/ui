import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

// An iOS pull-down: trailing icons, thick bands between groups, a destructive
// row, a shortcut, a submenu and a disabled row. Choices arrive through
// `onAction` on the menu, submenu rows included — the line below is what it
// received.
export default function Actions() {
  const [log, setLog] = useState<string[]>([])
  const act = (value: string) => setLog((l) => [value, ...l].slice(0, 3))
  // The ThemeScope is only here so the overlay wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm justify-items-start gap-4">
      <DropdownMenu onAction={act}>
        <DropdownMenuTrigger render={<Button variant="secondary" size="icon" />} aria-label="Photo actions">
          <Icon name="ellipsis" size={20} />
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem value="copy" icon={<Icon name="copy" size={20} />}>
            Copy
          </DropdownMenuItem>
          <DropdownMenuItem value="share" icon={<Icon name="share" size={20} />}>
            Share…
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>Move to album</DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem value="album-recents">Recents</DropdownMenuItem>
              <DropdownMenuItem value="album-trip">Lisbon trip</DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem value="rename" shortcut="mod+r">
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem value="info" icon={<Icon name="info" size={20} />} description="Captured Sep 22">
            Show info
          </DropdownMenuItem>
          <DropdownMenuItem value="lock" disabled icon={<Icon name="lock" size={20} />}>
            Lock album
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem value="delete" destructive icon={<Icon name="trash" size={20} />}>
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <p className="m-0 text-footnote text-muted-foreground" aria-live="polite">
        {log.length ? `Last actions: ${log.join(', ')}` : 'Open the menu and choose an action.'}
      </p>
    </ThemeScope>
  )
}
