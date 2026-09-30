import { useState } from 'react'
import { cn, pressable, brandTile } from '@/lib/utils'
import { Icon } from '@/lib/icon'

// `pressable` is a class fragment for a custom tappable element: no tap flash,
// the host font, and a brightness nudge on hover (dimmer on light surfaces,
// brighter on dark ones). Compose it with your own shape and colors; it adds no
// layout. The left button is the same element without it.
const shape = 'cursor-pointer rounded-full border border-border bg-card px-4 py-2 text-subhead font-semibold text-foreground'

export default function Pressable() {
  const [count, setCount] = useState(0)
  return (
    <div className="mx-auto grid max-w-[520px] gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <button type="button" className={shape} onClick={() => setCount((c) => c + 1)}>
          Plain
        </button>
        <button type="button" className={cn(pressable, shape)} onClick={() => setCount((c) => c + 1)}>
          With pressable
        </button>
        <span className="text-footnote text-muted-foreground tabular-nums">Pressed {count} times. Hover each one.</span>
      </div>

      <div className="flex items-center gap-3 rounded-card border border-border bg-card p-3">
        <span className={cn(brandTile, 'grid size-10 shrink-0 place-items-center rounded-[11px]')}>
          <Icon name="asterisk" size={21} sw={2.1} className="text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-subhead font-semibold">brandTile</div>
          <div className="text-footnote text-muted-foreground">The accent fading into iOS indigo, at 135 degrees.</div>
        </div>
      </div>
    </div>
  )
}
