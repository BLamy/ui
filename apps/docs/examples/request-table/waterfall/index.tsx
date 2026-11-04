import { useState } from 'react'
import { RequestTable } from '@/components/ui/request-table'
import { Slider, SliderThumb, SliderTrack } from '@/components/ui/slider'
import { formatLogTime } from '@/lib/log-list-model'
import type { RequestRow, RequestTone } from '@/lib/request-table-model'

const ROUTES: { path: string; method: string; type: string; size: number; tone: RequestTone }[] = [
  { path: 'api/cart', method: 'GET', type: 'fetch', size: 1840, tone: 'primary' },
  { path: 'api/products', method: 'GET', type: 'fetch', size: 5200, tone: 'primary' },
  { path: 'assets/chunk-a81.js', method: 'GET', type: 'script', size: 88_000, tone: 'warning' },
  { path: 'img/product.webp', method: 'GET', type: 'img', size: 240_000, tone: 'success' },
  { path: 'api/checkout', method: 'POST', type: 'fetch', size: 420, tone: 'primary' },
  { path: 'styles/app.css', method: 'GET', type: 'css', size: 34_000, tone: 'accent' },
]

const ROWS: RequestRow[] = Array.from({ length: 200 }, (_, i) => {
  const route = ROUTES[(i * 5 + (i >> 2)) % ROUTES.length]
  return {
    id: i,
    url: `https://shop.example.com/${route.path}?n=${i}`,
    method: route.method,
    status: i % 37 === 9 ? 500 : i % 23 === 7 ? 404 : 200,
    type: route.type,
    size: route.size + i * 17,
    time: i * 95 + (i % 7) * 11,
    duration: 20 + ((i * 53) % 600),
    tone: route.tone,
  }
})

const END = (ROWS[199].time ?? 0) + 620

// Press a header to sort, and drag a header's edge to resize its column. Drag the time and the line moves across the
// waterfall, with the requests sent after it dimmed.
export default function Waterfall() {
  const [time, setTime] = useState(ROWS[9].time ?? 0)
  return (
    <div className="flex h-[440px] w-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Slider<number> aria-label="Time" size="sm" className="min-w-0 flex-1" minValue={0} maxValue={END} value={time} onChange={setTime}>
          <SliderTrack><SliderThumb /></SliderTrack>
        </Slider>
        <span className="shrink-0 text-caption text-muted-foreground tabular-nums">{formatLogTime(time)}</span>
      </div>
      <RequestTable aria-label="Requests" rows={ROWS} timeRange={[0, END]} playhead={time} onRowPress={(row) => setTime(row.time ?? 0)} className="min-h-0 flex-1" />
    </div>
  )
}
