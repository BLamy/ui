import { useState } from 'react'
import { Filmstrip } from '@/components/ui/filmstrip'
import { Slider } from '@/components/ui/slider'

// Frames for 0–20 s of a clip (in an app, from useMediaFrames). The strip tiles
// its width with frame-shaped cells and shows, in each, the frame nearest the
// time that cell covers: narrow the range and frames repeat, widen it and they
// thin out, the way a timeline clip reads as you trim and zoom it.
const frame = (n: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="54"><rect width="96" height="54" fill="hsl(${(n * 17) % 360} 65% 45%)"/><text x="48" y="35" font-size="18" font-family="sans-serif" fill="white" text-anchor="middle">${n}s</text></svg>`,
  )}`
const FRAMES = Array.from({ length: 20 }, (_, i) => ({ time: i + 0.5, src: frame(i) }))

export default function FilmstripRange() {
  const [range, setRange] = useState([4, 12])
  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 p-4">
      <div className="h-14 overflow-hidden rounded-ctl bg-secondary">
        <Filmstrip frames={FRAMES} from={range[0]} to={range[1]} />
      </div>
      <div className="h-8 w-1/2 overflow-hidden rounded-ctl bg-secondary">
        <Filmstrip frames={FRAMES} from={range[0]} to={range[1]} />
      </div>
      <Slider label={`Media range: ${range[0]}–${range[1]} s`} minValue={0} maxValue={20} step={0.5} value={range}
        onChange={(v) => setRange(v as number[])} />
    </div>
  )
}
