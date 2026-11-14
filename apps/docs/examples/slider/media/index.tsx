import { useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { ThemeScope } from '@/lib/theme'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

// `variant` swaps the track and fill for translucent white (on-dark) or black
// (on-light) so the slider reads over artwork; `size="sm"` is the scrubber with
// a small thumb that grows while dragging. Any other color is a CSS variable:
// --bl-slider-track, --bl-slider-fill, --bl-slider-thumb.
export default function Media() {
  const [pos, setPos] = useState(84)
  const length = 212
  return (
    <div className="mx-auto grid max-w-sm gap-4">
      <div className="grid gap-4 rounded-card bg-linear-to-br from-primary to-[#101014] p-5 text-white">
        <div className="grid gap-1.5">
          <Slider aria-label="Playback position" variant="on-dark" size="sm" max={length} value={pos} onValueChange={setPos} />
          <div className="flex justify-between text-caption2 tabular-nums opacity-70">
            <span>{fmt(pos)}</span>
            <span>-{fmt(length - pos)}</span>
          </div>
        </div>
        <Slider aria-label="Volume" variant="on-dark" defaultValue={70} />
      </div>
      <ThemeScope appearance="light" className="grid gap-4 rounded-card bg-background p-5 text-foreground">
        <Slider aria-label="Warmth" variant="on-light" size="sm" defaultValue={55} />
        <Slider aria-label="Exposure" className="[--bl-slider-fill:var(--success)]" defaultValue={62} />
      </ThemeScope>
    </div>
  )
}
