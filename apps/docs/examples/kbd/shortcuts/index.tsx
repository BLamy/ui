import { buttonVariants } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Kbd, KbdGroup } from '@/components/ui/kbd'

const SHORTCUTS: [string, string][] = [
  ['Search', 'mod+k'],
  ['New tab', 'mod+t'],
  ['Command palette', 'shift+mod+p'],
  ['Close window', 'mod+w'],
]

// A Kbd is one keycap; a KbdGroup spaces a chord of several. `keys` takes a
// UI SDK shortcut string and shows it for the reader's platform (⌘K on Apple,
// Ctrl+K elsewhere). A menu item draws its own hint from its `shortcut` prop.
export default function Shortcuts() {
  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <div className="flex items-center gap-3 text-subhead text-foreground/70">
        <DropdownMenu>
          <DropdownMenuTrigger className={buttonVariants({ variant: 'secondary' })}>File</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem shortcut="mod+n">New file</DropdownMenuItem>
            <DropdownMenuItem shortcut="mod+s">Save</DropdownMenuItem>
            <DropdownMenuItem shortcut="mod+w">Close</DropdownMenuItem>
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
              <Kbd keys={keys} />
            </li>
          ))}
          <li className="flex items-center justify-between">
            Spelled out, key by key
            <KbdGroup>
              <Kbd>⇧</Kbd>
              <Kbd>⌘</Kbd>
              <Kbd>P</Kbd>
            </KbdGroup>
          </li>
        </ul>
      </div>
    </div>
  )
}
