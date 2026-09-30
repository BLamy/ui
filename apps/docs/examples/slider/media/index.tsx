import { useState } from 'react'
import { Slider } from '@/components/ui/slider'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`

// `tone` swaps the track and fill for translucent white (onDark) or black
// (onLight) so the slider reads over artwork; `size="sm"` is the scrubber with
// a small thumb that grows while dragging. trackColor / fillColor / thumbColor
// take any CSS color.
export default function Media() {
  const [pos, setPos] = useState(84)
  const length = 212
  return (
    <div className="mx-auto grid max-w-sm gap-4">
      <div className="grid gap-4 rounded-card bg-linear-to-br from-primary to-foreground p-5 text-white">
        <div className="grid gap-1.5">
          <Slider aria-label="Playback position" tone="onDark" size="sm" maxValue={length} value={pos} onChange={(v) => setPos(v as number)} />
          <div className="flex justify-between text-caption2 tabular-nums opacity-70">
            <span>{fmt(pos)}</span>
            <span>-{fmt(length - pos)}</span>
          </div>
        </div>
        <Slider aria-label="Volume" tone="onDark" defaultValue={70} />
      </div>
      <div className="grid gap-4 rounded-card bg-secondary p-5">
        <Slider aria-label="Warmth" tone="onLight" size="sm" defaultValue={55} />
        <Slider aria-label="Exposure" fillColor="var(--success)" defaultValue={62} />
      </div>
    </div>
  )
}
