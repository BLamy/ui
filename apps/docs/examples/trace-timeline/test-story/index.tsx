import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { SHOP_RECORDING } from '@/components/blocks/replay-debugger/shop-recording'
import { CodeEditor, type CodeEditorGutter } from '@/components/ui/code-editor'
import { LogList } from '@/components/ui/log-list'
import { TraceTimeline } from '@/components/ui/trace-timeline'
import { splitCodeLines } from '@/lib/code-editor-model'
import type { LogRow } from '@/lib/log-list-model'
import { stopAxis } from '@/lib/trace-timeline-model'
import { buildStory, sinceStart, type Story } from './story'

const story: Story = buildStory(SHOP_RECORDING)
const source = SHOP_RECORDING.sources[0]
const LINES = splitCodeLines(source.contents)
const axis = stopAxis(story.stops, story.range)
const format = sinceStart(story.range.start)
const hitCounts = source.hitCounts as Record<number, number>

const Values = ({ values }: { values: Story['entries'][number]['values'] }) =>
  values.length ? (
    <span className="ml-3 inline-flex min-w-0 gap-2 truncate font-mono text-caption2 text-muted-foreground">
      {values.map((v) => <span key={v.name}><span className="text-tertiary-foreground">{v.name}</span> {v.text}</span>)}
    </span>
  ) : null

// A story row: the line, indented by how deep the stack was, with what its frame held beside it.
const ROWS: LogRow[] = story.entries.map((e) => ({
  id: e.step,
  time: e.ms,
  level: e.logged ? 'info' : e.code.startsWith('throw') ? 'error' : 'log',
  source: `${e.file}:${e.line}`,
  text: e.code,
  message: (
    <span className="flex min-w-0 items-baseline" style={{ paddingInlineStart: e.depth * 12 }}>
      <span className="shrink-0 font-mono text-caption">{e.code}</span>
      {e.logged ? <span className="ml-3 truncate text-caption text-success">→ {e.logged.text}</span> : <Values values={e.values} />}
    </span>
  ),
}))

// A run of shop.js as a test story. Scrub the timeline and the story scrolls with it, and the code follows. Under 600 px it's the phone layout: the timeline is a rail on the
// story's edge, under your thumb, with the line you're on in a card above.
export default function TestStory() {
  const frame = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1000)
  const [time, setTime] = useState(() => story.entries[story.entries.findIndex((e) => e.code.startsWith('const rate'))].ms)
  const at = story.at(time)
  const now = story.entries[at]

  useLayoutEffect(() => {
    const el = frame.current
    if (!el) return undefined
    const observer = new ResizeObserver(() => setWidth(el.clientWidth))
    observer.observe(el)
    setWidth(el.clientWidth)
    return () => observer.disconnect()
  }, [])
  const narrow = width < 600

  const gutters = useMemo<CodeEditorGutter[]>(() => [{
    id: 'hits',
    width: 28,
    align: 'end',
    render: (line) => (hitCounts[line] ? <span className="pr-1 font-mono text-caption2 text-tertiary-foreground">{hitCounts[line]}×</span> : null),
  }], [])

  const timeline = (
    <TraceTimeline
      aria-label="Story"
      range={story.range}
      axis={axis}
      lanes={story.lanes}
      stops={story.stops}
      value={time}
      onValueChange={(t) => setTime(t)}
      formatTime={format}
      stopsLabel="Lines"
      orientation={narrow ? 'vertical' : 'horizontal'}
      className={narrow ? 'inset-y-2' : 'shrink-0'}
    />
  )
  const list = (
    <LogList
      aria-label="Story"
      rows={ROWS}
      currentId={now.step}
      currentTime={time}
      formatTime={format}
      overflow="expand"
      onAction={(_id, { row }) => setTime(row.time ?? time)}
      className="h-full"
    />
  )

  return (
    <div ref={frame} className="flex h-[560px] flex-col overflow-hidden rounded-card bg-card shadow-hairline">
      <div className="flex shrink-0 items-baseline gap-2 border-b border-border px-3 py-2">
        <span className="font-mono text-caption">{source.url}</span>
        <span className="truncate text-caption text-muted-foreground">
          step {at + 1} of {story.entries.length} · {now.functionName} · line {now.line}
        </span>
        <span className="ml-auto shrink-0 text-caption2 text-tertiary-foreground tabular-nums">{format(time)}</span>
      </div>
      {narrow ? (
        <>
          <div className="shrink-0 border-b border-border bg-secondary/40 px-3 py-2">
            <div className="truncate font-mono text-caption text-foreground">{now.code}</div>
            <div className="mt-0.5 flex flex-wrap gap-x-3 font-mono text-caption2 text-muted-foreground">
              {now.logged ? <span className="text-success">→ {now.logged.text}</span> : now.values.map((v) => <span key={v.name}>{v.name} = {v.text}</span>)}
              {!now.logged && !now.values.length ? <span>no locals</span> : null}
            </div>
          </div>
          <div className="relative min-h-0 flex-1">
            <div className="h-full pe-12">{list}</div>
            {timeline}
          </div>
        </>
      ) : (
        <>
          {timeline}
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] border-t border-border">
            <div className="min-h-0 border-e border-border">{list}</div>
            <div className="min-h-0">
              <CodeEditor
                readOnly
                variant="plain"
                lines={LINES}
                aria-label={source.url}
                gutters={gutters}
                currentLine={now.line}
                currentColumn={now.column}
                lineDecoration={(line) => (hitCounts[line] ? null : { textClassName: 'opacity-45' })}
                className="h-full"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
