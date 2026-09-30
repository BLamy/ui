import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Kbd, KbdGroup } from '@/components/ui/kbd'

const SHORTCUTS: [string, string[]][] = [
  ['Search', ['⌘', 'K']],
  ['New tab', ['⌘', 'T']],
  ['Command palette', ['⇧', '⌘', 'P']],
  ['Close window', ['⌘', 'W']],
]

// A Kbd is one keycap; a KbdGroup spaces a chord of several. Inside a menu
// item, pass a single Kbd as the item's `shortcut` — react-aria links it to the
// item as its description.
export default function Shortcuts() {
  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <div className="flex items-center gap-3 text-subhead text-muted-foreground">
        <DropdownMenu>
          <Button variant="secondary">File</Button>
          <DropdownMenuContent>
            <DropdownMenuItem shortcut={<Kbd>⌘N</Kbd>}>New file</DropdownMenuItem>
            <DropdownMenuItem shortcut={<Kbd>⌘S</Kbd>}>Save</DropdownMenuItem>
            <DropdownMenuItem shortcut={<Kbd>⌘W</Kbd>}>Close</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <span>
          or press <Kbd>Esc</Kbd> to dismiss
        </span>
      </div>

      <div className="overflow-hidden rounded-card bg-card p-4 shadow-hairline">
        <ul className="m-0 grid list-none gap-3 p-0 text-subhead text-foreground">
          {SHORTCUTS.map(([action, keys]) => (
            <li key={action} className="flex items-center justify-between">
              {action}
              <KbdGroup>
                {keys.map((k) => (
                  <Kbd key={k}>{k}</Kbd>
                ))}
              </KbdGroup>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
