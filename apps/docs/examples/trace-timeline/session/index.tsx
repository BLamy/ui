import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { LogList } from '@/components/ui/log-list'
import { TraceTimeline } from '@/components/ui/trace-timeline'
import type { LogRow } from '@/lib/log-list-model'
import { formatTraceTime, stopAxis, type TraceKey, type TraceRange } from '@/lib/trace-timeline-model'
import { RANGE, session } from './data'

// The session's stops, as rows on the same clock: the list under the timeline is what happened, in order.
let rows: LogRow[] | null = null
const rowsOf = (stops: ReturnType<typeof session>['stops']) =>
  (rows ??= stops.map((stop, i): LogRow => ({
    id: stop.key ?? i,
    time: stop.time,
    level: stop.tone === 'destructive' ? 'error' : stop.level === 1 ? 'info' : 'log',
    source: stop.preview,
    message: stop.caption ?? '',
  })))

// One timeline. Under 600 px wide it's a rail over the list, and above that a strip over it: only `orientation` changes,
// and this holds `value` and `view`, so the playhead and the zoom stay. Scrub either and the list scrolls to the moment
// you're on; press a row to go there. Drag the frame's handle across, or pick a viewport.
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
        onFocusedLaneChange={setLane}
        selectedThread={thread}
        onSelectedThreadChange={setThread}
        selectedRequest={request}
        onSelectedRequestChange={setRequest}
        orientation={narrow ? 'vertical' : 'horizontal'}
        className={narrow ? 'inset-y-2' : 'shrink-0'}
      />
      <div className={narrow ? 'relative min-h-0 flex-1 pe-12' : 'relative min-h-0 flex-1 border-t border-border'}>
        <LogList
          aria-label="What happened"
          rows={rowsOf(stops)}
          currentTime={time}
          formatTime={(t) => formatTraceTime(t, 1000)}
          onAction={(_id, { row }) => setTime(row.time ?? time)}
          className="h-full"
        />
      </div>
    </div>
  )
}
