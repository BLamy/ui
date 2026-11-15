import { useState } from 'react'
import { Toggle, ToggleIcon } from '@/components/ui/toggle'
import { Icon } from '@/lib/icon'

// Toggle is a two-state button (aria-pressed). Icon-only toggles need an
// aria-label; `variant` sets the resting look, `size` the height. `quiet` with
// `size="icon-sm"` is the toolbar tool, filled while it is on.
export default function Toolbar() {
  const [pinned, setPinned] = useState(false)
  return (
    <div className="mx-auto grid max-w-sm justify-items-start gap-5">
      <div className="flex items-center gap-2">
        <Toggle aria-label="Pin" pressed={pinned} onPressedChange={setPinned}>
          <Icon name="pin" size={16} />
        </Toggle>
        <Toggle variant="secondary" aria-label="Favorite" defaultPressed>
          <Icon name="star" size={16} />
        </Toggle>
        <Toggle variant="outline" aria-label="Notifications">
          <Icon name="bell" size={16} />
        </Toggle>
        <Toggle variant="outline" disabled aria-label="Locked">
          <Icon name="lock" size={16} />
        </Toggle>
      </div>
      <div className="flex items-center gap-1">
        <Toggle variant="quiet" size="icon-sm" aria-label="Bookmark" defaultPressed>
          <Icon name="bookmark" size={18} sw={1.7} />
        </Toggle>
        <Toggle variant="quiet" size="icon-sm" aria-label="Show sidebar">
          <Icon name="sidebar-left" size={18} sw={1.7} />
        </Toggle>
      </div>
      <div className="flex items-center gap-2">
        <Toggle size="sm" variant="secondary"><ToggleIcon><Icon name="bell" size={14} /></ToggleIcon>Mute</Toggle>
        <Toggle variant="secondary"><ToggleIcon><Icon name="bell" size={16} /></ToggleIcon>Mute</Toggle>
        <Toggle size="lg" variant="secondary"><ToggleIcon><Icon name="bell" size={18} /></ToggleIcon>Mute</Toggle>
      </div>
      <p className="m-0 text-footnote text-muted-foreground">{pinned ? 'Pinned to the top.' : 'Not pinned.'}</p>
    </div>
  )
}
