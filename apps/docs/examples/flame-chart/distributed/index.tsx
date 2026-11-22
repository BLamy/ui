import { useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { FlameChart, type FlameChartHandle } from '@/components/ui/flame-chart'
import { Input } from '@/components/ui/input'
import { Toggle } from '@/components/ui/toggle'
import { FLAME_ERROR, FLAME_PENDING, criticalPath, familyOf, firstRoot, formatDuration, percentile, selfTime } from '@/lib/flame-chart-model'
import { checkoutTrace } from './data'

// A host that does what a trace view does: a search lights its matches, a selection lights its family (what led to it
// and what it set off), and "Critical path" lights what the selected span waited on. All of it is `highlight`.
export default function Distributed() {
  const data = useMemo(checkoutTrace, [])
  const chart = useRef<FlameChartHandle>(null)
  const [selected, setSelected] = useState(-1)
  const [query, setQuery] = useState('')
  const [critical, setCritical] = useState(false)
  const [links, setLinks] = useState(true)
  const [opened, setOpened] = useState<number | null>(null)

  const highlight = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q) {
      const hits: number[] = []
      for (let i = 0; i < data.start.length; i++) if (data.names[data.name[i]].toLowerCase().includes(q)) hits.push(i)
      return hits
    }
    if (critical) return criticalPath(data, selected >= 0 ? selected : firstRoot(data))
    return selected >= 0 ? familyOf(data, selected) : null
  }, [data, query, critical, selected])

  // How this operation does across the whole trace, for the panel.
  const stats = useMemo(() => {
    if (selected < 0) return null
    const name = data.name[selected]
    const durations: number[] = []
    for (let i = 0; i < data.start.length; i++) if (data.name[i] === name) durations.push(data.end[i] - data.start[i])
    return { count: durations.length, p50: percentile(durations, 0.5), p95: percentile(durations, 0.95) }
  }, [data, selected])

  const matches = query.trim() && Array.isArray(highlight) ? highlight.length : null
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input className="w-56 max-w-full" placeholder="Search spans" aria-label="Search spans" value={query} onValueChange={setQuery} />
        <Toggle variant="outline" size="sm" pressed={critical} onPressedChange={setCritical}>Critical path</Toggle>
        <Toggle variant="outline" size="sm" pressed={links} onPressedChange={setLinks}>Links</Toggle>
        <Button variant="outline" size="sm" onClick={() => chart.current?.fit()}>Fit</Button>
        {selected >= 0 ? <Button variant="outline" size="sm" onClick={() => chart.current?.reveal(selected, { zoom: true })}>Zoom to span</Button> : null}
        {matches != null ? <span className="text-footnote text-muted-foreground tabular-nums">{matches} {matches === 1 ? 'match' : 'matches'}</span> : null}
      </div>
      <FlameChart
        ref={chart}
        data={data}
        frame="card"
        aria-label="Checkout trace"
        selected={selected}
        onSelectedChange={setSelected}
        onSpanActivate={setOpened}
        highlight={highlight}
        showLinks={links}
        className="h-[440px]"
      />
      <div className="min-h-[60px] rounded-card bg-secondary px-4 py-3 text-footnote" aria-live="polite">
        {selected >= 0 && stats ? (
          <div className="flex flex-wrap gap-x-6 gap-y-1 tabular-nums">
            <span className="font-semibold text-foreground">{data.names[data.name[selected]]}</span>
            <span className="text-muted-foreground">{data.lanes[data.lane[selected]].title}</span>
            <span>Duration {formatDuration(data.end[selected] - data.start[selected])}</span>
            <span>Self {formatDuration(selfTime(data, selected))}</span>
            <span className="text-muted-foreground">×{stats.count} · p50 {formatDuration(stats.p50)} · p95 {formatDuration(stats.p95)}</span>
            {data.flags[selected] & FLAME_ERROR ? <span className="font-medium text-destructive">Failed</span> : null}
            {data.flags[selected] & FLAME_PENDING ? <span className="font-medium text-warning">Still running</span> : null}
            {opened === selected ? <span className="text-primary">Opened in the debugger</span> : null}
          </div>
        ) : (
          <span className="text-muted-foreground">Select a span (or press ↓ in the chart), then ← → ↑ ↓ to move and Enter to open it.</span>
        )}
      </div>
    </div>
  )
}
