import { useState } from 'react'
import type { Key } from 'react-aria-components'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
} from '@/components/ui/dropdown-menu'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

// An iOS pull-down: trailing icons, thick bands between groups, a destructive
// row, a shortcut, a submenu and a disabled row. Choices arrive through
// `onAction` on the menu — the list below is what it received.
export default function Actions() {
  const [log, setLog] = useState<string[]>([])
  const act = (key: Key) => setLog((l) => [String(key), ...l].slice(0, 3))
  // The ThemeScope is only here so the portalled overlay wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm justify-items-start gap-4">
      <DropdownMenu>
        <Button variant="secondary" aria-label="Photo actions" size="icon">
          <Icon name="ellipsis" size={20} />
        </Button>
        <DropdownMenuContent aria-label="Photo actions" onAction={act}>
          <DropdownMenuItem id="copy" icon={<Icon name="copy" size={20} />}>
            Copy
          </DropdownMenuItem>
          <DropdownMenuItem id="share" icon={<Icon name="share" size={20} />}>
            Share…
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuItem id="move">Move to album</DropdownMenuItem>
            <DropdownMenuContent aria-label="Albums" onAction={act}>
              <DropdownMenuItem id="album-recents">Recents</DropdownMenuItem>
              <DropdownMenuItem id="album-trip">Lisbon trip</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            id="rename"
            shortcut={<DropdownMenuShortcut>⌘R</DropdownMenuShortcut>}
          >
            Rename
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem id="info" icon={<Icon name="info" size={20} />} description="Captured Sep 22">
            Show info
          </DropdownMenuItem>
          <DropdownMenuItem id="lock" isDisabled icon={<Icon name="lock" size={20} />}>
            Lock album
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem id="delete" variant="destructive" icon={<Icon name="trash" size={20} />}>
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
