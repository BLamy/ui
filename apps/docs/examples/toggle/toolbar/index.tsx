import { useState } from 'react'
import { Toggle } from '@/components/ui/toggle'
import { Icon } from '@/lib/icon'

// Toggle is a two-state button (aria-pressed). Icon-only toggles need an
// aria-label; `variant` sets the resting look, `size` the height.
export default function Toolbar() {
  const [pinned, setPinned] = useState(false)
  return (
    <div className="mx-auto grid max-w-sm justify-items-start gap-5">
      <div className="flex items-center gap-2">
        <Toggle aria-label="Pin" isSelected={pinned} onChange={setPinned}>
          <Icon name="pin" size={16} />
        </Toggle>
        <Toggle variant="filled" aria-label="Favorite" defaultSelected>
          <Icon name="star" size={16} />
        </Toggle>
        <Toggle variant="outline" aria-label="Notifications">
          <Icon name="bell" size={16} />
        </Toggle>
        <Toggle variant="outline" isDisabled aria-label="Locked">
          <Icon name="lock" size={16} />
        </Toggle>
      </div>
      <div className="flex items-center gap-2">
        <Toggle size="sm" variant="filled"><Icon name="bell" size={14} />Mute</Toggle>
        <Toggle variant="filled"><Icon name="bell" size={16} />Mute</Toggle>
        <Toggle size="lg" variant="filled"><Icon name="bell" size={18} />Mute</Toggle>
      </div>
      <p className="m-0 text-footnote text-muted-foreground">{pinned ? 'Pinned to the top.' : 'Not pinned.'}</p>
    </div>
  )
}
