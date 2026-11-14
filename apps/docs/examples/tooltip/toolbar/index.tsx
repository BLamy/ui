import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipShortcut, TooltipTrigger } from '@/components/ui/tooltip'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'

// Hover warms a tooltip up (500ms by default, then neighbours open at once);
// keyboard focus opens it immediately; Esc closes it; touch never does. On an
// icon button the tooltip is the button's name, so it needs no aria-label. It
// is not where essential information lives.
export default function Toolbar() {
  return (
    <ThemeScope className="mx-auto grid max-w-md justify-items-center gap-6 py-6">
      <div className="flex gap-2 rounded-card bg-card p-2 shadow-hairline">
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon" />}>
            <Icon name="link" size={18} />
          </TooltipTrigger>
          <TooltipContent>Copy link</TooltipContent>
        </Tooltip>
        <Tooltip shortcut="mod+shift+s">
          <TooltipTrigger render={<Button variant="ghost" size="icon" />}>
            <Icon name="share" size={18} />
          </TooltipTrigger>
          <TooltipContent>Share<TooltipShortcut /></TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon" />} aria-label="Star">
            <Icon name="star" size={18} />
          </TooltipTrigger>
          <TooltipContent side="bottom" arrow={false}>No arrow, below</TooltipContent>
        </Tooltip>
        <Tooltip delay={0} closeDelay={0}>
          <TooltipTrigger render={<Button variant="ghost" size="icon" />} aria-label="Info">
            <Icon name="info" size={18} />
          </TooltipTrigger>
          <TooltipContent side="end">Opens instantly: delay=0</TooltipContent>
        </Tooltip>
      </div>
    </ThemeScope>
  )
}
