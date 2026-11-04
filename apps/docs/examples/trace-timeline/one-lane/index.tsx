import { useMemo, useState } from 'react'
import { TraceTimeline } from '@/components/ui/trace-timeline'
import type { TraceLane, TraceStop } from '@/lib/trace-timeline-model'

const MINUTE = 60_000
const RANGE = { start: 0, end: 10 * MINUTE }

// Sorted times, as a typed array: a thousand of them or a hundred million cost the same to draw.
const times = Float64Array.from({ length: 20_000 }, (_, i) => {
  const t = (i / 20_000) * RANGE.end
  return t + Math.sin(t / 40_000) * 30_000 + 30_000
}).sort()

const STOPS: Array<TraceStop<string>> = [
  { key: 'open', time: 1 * MINUTE, caption: 'Page opened', tone: 'info' },
  { key: 'click', time: 4 * MINUTE, caption: 'Clicked Save', preview: 'Sent the draft to the server' },
  { key: 'fail', time: 7.5 * MINUTE, caption: 'Save failed', preview: '500 from POST /drafts', tone: 'error' },
]

// The smallest useful timeline: one lane of plain data, holding its own zoom. `value` is yours, in milliseconds.
export default function OneLane() {
  const [time, setTime] = useState(4 * MINUTE)
  const lanes = useMemo<TraceLane[]>(() => [{ key: 'run', density: { label: 'Events', times } }], [])
  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-card shadow-hairline">
      <TraceTimeline range={RANGE} lanes={lanes} stops={STOPS} value={time} onValueChange={(t) => setTime(t)} />
    </div>
  )
}
