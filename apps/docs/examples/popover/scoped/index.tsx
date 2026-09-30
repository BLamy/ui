import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import { PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import { ThemeScope } from '@/lib/theme'

// Overlays render in a portal, outside the DOM of whatever opened them, so CSS
// inheritance cannot reach them. Popover, Tooltip, DropdownMenu, Select,
// Dialog and Sheet read the nearest ThemeScope (useThemeScopeProps) and wear
// it: same appearance, tint and variables as the surface that opened them.
export default function Scoped() {
  return (
    <ThemeScope
      appearance="dark"
      tint="#FF9F0A"
      vars={{ radius: '14px' }}
      className="mx-auto grid max-w-md gap-4 rounded-card bg-background p-5 text-foreground shadow-hairline"
    >
      <p className="m-0 text-detail text-muted-foreground">
        A dark, amber scope on a page that may be light. Open each one.
      </p>
      <div className="flex flex-wrap gap-3">
        <TooltipTrigger>
          <Button>Hover me</Button>
          <Tooltip>Inverted: the scope's foreground on its background</Tooltip>
        </TooltipTrigger>
        <PopoverTrigger>
          <Button variant="secondary">Popover</Button>
          <PopoverContent aria-label="Export options" placement="bottom start">
            <p className="m-0 text-detail text-muted-foreground">
              Surface from <code>--popover</code>, text from <code>--popover-foreground</code>.
            </p>
            <Button size="sm" className="mt-3">Primary is the tint</Button>
          </PopoverContent>
        </PopoverTrigger>
        <DropdownMenu>
          <Button variant="secondary">Menu</Button>
          <DropdownMenuContent aria-label="Actions">
            <DropdownMenuItem id="duplicate">Duplicate</DropdownMenuItem>
            <DropdownMenuItem id="archive">Archive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </ThemeScope>
  )
}
