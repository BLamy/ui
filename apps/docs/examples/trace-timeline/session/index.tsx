import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { TraceTimeline } from '@/components/ui/trace-timeline'
import { stopAxis, type TraceKey, type TraceRange } from '@/lib/trace-timeline-model'
import { RANGE, session } from './data'

const ROWS = [
  ['Cart recalculated', 'cart.ts:42'],
  ['Rendered <OrderList>', 'orders.tsx:120'],
  ['Cache miss for session', 'session.ts:17'],
  ['GET /api/orders', '200 in 84 ms'],
  ['Hydration finished', 'entry.client.tsx:9'],
  ['Socket heartbeat', 'socket.ts:61'],
  ['POST /api/cart', '200 in 132 ms'],
  ['Retrying after 429', 'fetch.ts:77'],
  ['GET /api/inventory', '200 in 61 ms'],
  ['Rendered <Totals>', 'totals.tsx:88'],
]

// One timeline. Under 600 px wide it's a rail over the panel, and above that a strip over it: only `orientation` changes,
// and this holds `value` and `view`, so the playhead and the zoom stay. Drag the frame's handle across, or pick a viewport.
export default function Session({ variant = 'time' }: { variant?: string }) {
  const { lanes, stops, requests, fetchActivity } = session()
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1000)
  const [time, setTime] = useState(1_512_000)
  const [view, setView] = useState<TraceRange>(RANGE)
  const [lane, setLane] = useState('browser')
  const [thread, setThread] = useState<TraceKey | null>(1)
  const [request, setRequest] = useState<TraceKey | null>(null)
  const axis = useMemo(() => (variant === 'stops' ? stopAxis(stops, RANGE) : undefined), [variant, stops])

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return undefined
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])

  const narrow = width < 600
  return (
    <div ref={frame} className="relative flex h-[560px] flex-col overflow-hidden rounded-card bg-card shadow-hairline">
      <TraceTimeline
        range={RANGE}
        axis={axis}
        lanes={lanes}
        stops={stops}
        requests={requests}
        fetchActivity={fetchActivity}
        value={time}
        onValueChange={(t) => setTime(t)}
        view={view}
        onViewChange={setView}
        focusedLane={lane}
        onFocusLane={setLane}
        selectedThread={thread}
        onSelectThread={setThread}
        selectedRequest={request}
        onSelectRequest={setRequest}
        orientation={narrow ? 'vertical' : 'horizontal'}
        top={8}
        bottom={8}
        className={narrow ? undefined : 'shrink-0'}
      />
      <div className="relative min-h-0 flex-1 overflow-y-auto">
        <List>
          <ListSection>
            {ROWS.map(([title, subtitle]) => (
              <ListRow key={title} title={title} subtitle={subtitle} accessory="chevron" onPress={() => {}} />
            ))}
          </ListSection>
        </List>
      </div>
    </div>
  )
}
