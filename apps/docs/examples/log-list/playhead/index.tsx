import { useState } from 'react'
import { LogList } from '@/components/ui/log-list'
import { Slider, SliderThumb, SliderTrack } from '@/components/ui/slider'
import { formatLogTime, type LogRow } from '@/lib/log-list'

const MESSAGES: Pick<LogRow, 'level' | 'source' | 'message'>[] = [
  { level: 'log', source: 'app.tsx:42', message: 'Rendered <CartPage> in 12 ms' },
  { level: 'debug', source: 'store.ts:204', message: 'cache hit: product:812' },
  { level: 'log', source: 'router.ts:77', message: '[router] navigated to /checkout' },
  { level: 'info', source: 'app.tsx:50', message: 'Hydrated 96 components in 21 ms' },
  { level: 'log', source: 'api.ts:31', message: 'fetching /api/cart?user=12' },
  { level: 'warn', source: 'api.ts:58', message: 'Slow response from /api/cart (1,204 ms)' },
  { level: 'log', source: 'store.ts:90', message: 'state update: cart.items (3 items)' },
  { level: 'error', source: 'cart.tsx:118', message: "TypeError: Cannot read properties of undefined (reading 'price')" },
]

const ROWS: LogRow[] = Array.from({ length: 400 }, (_, i) => ({ id: i, time: i * 137, ...MESSAGES[(i * 5 + (i >> 3)) % MESSAGES.length] }))

// Drag the time and the marker follows it, with the rows after it dimmed. Press a row to go to it. Scroll away from the
// marker and a button offers the way back.
export default function Playhead() {
  const [time, setTime] = useState(ROWS[60].time ?? 0)
  return (
    <div className="flex h-[420px] w-full flex-col gap-2">
      <div className="flex items-center gap-2">
        <Slider<number> aria-label="Time" size="sm" className="min-w-0 flex-1" minValue={0} maxValue={ROWS[399].time} value={time} onChange={setTime}>
          <SliderTrack><SliderThumb /></SliderTrack>
        </Slider>
        <span className="shrink-0 text-caption text-muted-foreground tabular-nums">{formatLogTime(time)}</span>
      </div>
      <LogList aria-label="Console" rows={ROWS} currentTime={time} markerLabel="Paused here" onRowPress={(row) => setTime(row.time ?? 0)} className="min-h-0 flex-1" />
    </div>
  )
}
