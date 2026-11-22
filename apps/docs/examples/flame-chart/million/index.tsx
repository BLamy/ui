import { useMemo, useRef, useState } from 'react'
import { FlameChart, type FlameDrawStats } from '@/components/ui/flame-chart'
import { millionSpans } from './data'

// A million spans, built once as typed arrays (no objects per span). Each redraw reports what it took through `onDraw`:
// it's written straight into the line under the chart, so reporting it costs no render.
export default function Million() {
  const built = useMemo(() => {
    const began = performance.now()
    const data = millionSpans()
    return { data, ms: performance.now() - began }
  }, [])
  const [selected, setSelected] = useState(-1)
  const readout = useRef<HTMLSpanElement>(null)
  const recent = useRef<number[]>([])
  const onDraw = (stats: FlameDrawStats) => {
    if (stats.layer !== 'data' || !readout.current) return
    const r = recent.current
    r.push(stats.ms)
    if (r.length > 30) r.shift()
    const worst = Math.max(...r)
    readout.current.textContent = `data layer ${stats.ms.toFixed(1)} ms (worst of last ${r.length}: ${worst.toFixed(1)} ms) · ${stats.bars} bars, ${stats.runs} runs, ${stats.labels} labels, ${stats.links} links`
  }
  const { data, ms } = built
  return (
    <div className="flex flex-col gap-2">
      <FlameChart data={data} frame="card" aria-label="A million spans" selected={selected} onSelectedChange={setSelected} onDraw={onDraw} className="h-[500px]" />
      <p className="text-footnote text-muted-foreground tabular-nums">
        {data.start.length.toLocaleString('en-US')} spans in {data.lanes.length} services, {data.links?.from.length.toLocaleString('en-US')} links, built in {ms.toFixed(0)} ms ·{' '}
        <span ref={readout} data-testid="flame-draw-stats">…</span>
      </p>
    </div>
  )
}
