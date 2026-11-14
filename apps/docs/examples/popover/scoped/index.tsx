import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ThemeScope } from '@/lib/theme'

// Popups render into their layer host (BLProvider's root) or the browser's top
// layer, outside the DOM of whatever opened them, so CSS inheritance cannot
// reach them. Popover, Tooltip, DropdownMenu, Select, Dialog and Sheet read the
// nearest ThemeScope (useThemeScopeProps) and wear it: same appearance, tint
// and variables as the surface that opened them.
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
        <Tooltip>
          <TooltipTrigger render={<Button />}>Hover me</TooltipTrigger>
          <TooltipContent>Inverted: the scope's foreground on its background</TooltipContent>
        </Tooltip>
        <Popover>
          <PopoverTrigger render={<Button variant="secondary" />}>Popover</PopoverTrigger>
          <PopoverContent align="start">
            <PopoverTitle className="sr-only">Export options</PopoverTitle>
            <p className="m-0 text-detail text-muted-foreground">
              Surface from <code>--popover</code>, text from <code>--popover-foreground</code>.
            </p>
            <Button size="sm" className="mt-3">Primary is the tint</Button>
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="secondary" />}>Menu</DropdownMenuTrigger>
          <DropdownMenuContent aria-label="Actions">
            <DropdownMenuItem value="duplicate">Duplicate</DropdownMenuItem>
            <DropdownMenuItem value="archive">Archive</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </ThemeScope>
  )
}
