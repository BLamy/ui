import { Button } from '@/components/ui/button'
import { Tooltip, TooltipTrigger } from '@/components/ui/tooltip'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

// Hover warms a tooltip up (500ms by default, then neighbours open at once);
// keyboard focus opens it immediately; Esc closes it; touch never does. A
// tooltip names or hints an icon button — it is not where essential
// information lives.
export default function Toolbar() {
  // The ThemeScope is only here so the portalled overlay wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-md justify-items-center gap-6 py-6">
      <div className="flex gap-2 rounded-card bg-card p-2 shadow-hairline">
        <TooltipTrigger>
          <Button variant="ghost" size="icon" aria-label="Copy link">
            <Icon name="link" size={18} />
          </Button>
          <Tooltip>Copy link</Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" aria-label="Share">
            <Icon name="share" size={18} />
          </Button>
          <Tooltip>Share (⌘⇧S)</Tooltip>
        </TooltipTrigger>
        <TooltipTrigger>
          <Button variant="ghost" size="icon" aria-label="Star">
            <Icon name="star" size={18} />
          </Button>
          <Tooltip placement="bottom" arrow={false}>Star (no arrow, below)</Tooltip>
        </TooltipTrigger>
        <TooltipTrigger delay={0} closeDelay={0}>
          <Button variant="ghost" size="icon" aria-label="Info">
            <Icon name="info" size={18} />
          </Button>
          <Tooltip placement="end">Opens instantly: delay=0</Tooltip>
        </TooltipTrigger>
      </div>
    </ThemeScope>
  )
}
