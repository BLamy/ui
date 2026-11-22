import { useMemo, useState } from 'react'
import { FlameChart } from '@/components/ui/flame-chart'
import { flameData, formatDuration, selfTime, type FlameLane, type FlameSpanInput } from '@/lib/flame-chart-model'

const LANES: FlameLane[] = [
  { key: 'browser', title: 'Browser', subtitle: 'Safari 19' },
  { key: 'api', title: 'API', subtitle: 'api-7d9f · pid 41' },
  { key: 'db', title: 'Postgres', subtitle: 'primary' },
]

// Times in ms from the click. A span's `parent` is what caused it, in its own lane or another.
const SPANS: FlameSpanInput[] = [
  { id: 'click', lane: 'browser', name: 'click "Save"', start: 0, end: 212 },
  { id: 'fetch', parent: 'click', lane: 'browser', name: 'fetch PUT /api/notes/42', start: 4, end: 188, waiting: true },
  { id: 'render', parent: 'click', lane: 'browser', name: 'render <Note>', start: 190, end: 210 },
  { id: 'handler', parent: 'fetch', lane: 'api', name: 'PUT /api/notes/:id', start: 9, end: 184 },
  { id: 'auth', parent: 'handler', lane: 'api', name: 'session.verify', start: 11, end: 24 },
  { id: 'validate', parent: 'handler', lane: 'api', name: 'validate body', start: 25, end: 31 },
  { id: 'tx', parent: 'handler', lane: 'api', name: 'db.transaction', start: 32, end: 170, waiting: true },
  { id: 'select', parent: 'tx', lane: 'db', name: 'SELECT note FOR UPDATE', start: 36, end: 61 },
  { id: 'update', parent: 'tx', lane: 'db', name: 'UPDATE notes', start: 64, end: 151 },
  { id: 'index', parent: 'update', lane: 'db', name: 'update index notes_title', start: 70, end: 140 },
  { id: 'commit', parent: 'tx', lane: 'db', name: 'COMMIT', start: 153, end: 168 },
  { id: 'respond', parent: 'handler', lane: 'api', name: 'serialize', start: 172, end: 182 },
]

export default function Small() {
  const data = useMemo(() => flameData(LANES, SPANS), [])
  const [selected, setSelected] = useState(-1)
  const [time, setTime] = useState(0)
  const [opened, setOpened] = useState<string | null>(null)
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-2">
      <FlameChart
        data={data}
        frame="card"
        aria-label="Saving a note"
        selected={selected}
        onSelectedChange={setSelected}
        value={time}
        onValueChange={setTime}
        onSpanActivate={(i) => setOpened(data.names[data.name[i]])}
      />
      <p className="text-footnote text-muted-foreground tabular-nums" aria-live="polite">
        {selected >= 0
          ? `${data.names[data.name[selected]]} · ${formatDuration(data.end[selected] - data.start[selected])}, ${formatDuration(selfTime(data, selected))} of it its own`
          : 'Press a span to select it.'}
        {' · '}playhead at {formatDuration(time)}
        {opened ? ` · opened ${opened}` : ''}
      </p>
    </div>
  )
}
