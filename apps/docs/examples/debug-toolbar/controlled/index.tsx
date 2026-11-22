import { useCallback, useMemo, useState } from 'react'
import { bindingsAt, cacheIndex, navigateCached } from '@/components/ui/replay-debugger'
import { SHOP_RECORDING as recording } from '@/components/blocks/replay-debugger/shop-recording'
import type { NavigationKind } from '@/components/ui/replay-debugger'
import { CodeEditor, type CodeEditorGutter } from '@/components/ui/code-editor'
import { DebugToolbar, type DebugToolbarAction } from '@/components/ui/debug-toolbar'
import { TraceTimeline } from '@/components/ui/trace-timeline'
import { splitCodeLines } from '@/lib/code-editor-model'
import type { TraceLane } from '@/lib/trace-timeline-model'
import { cn } from '@/lib/utils'

/* A debugger whose state is one number you hold: the step. The toolbar, the code, the timeline and the values are all
   drawn from it, and every action is a pure function from (step, action, breakpoints) to the next step, read from a
   recording's JSON cache. The cache was made once, by replaying recording.dat with the linker; nothing here runs it. */

const index = cacheIndex(recording)
const source = recording.sources[0]
const LINES = splitCodeLines(source.contents)
const first = recording.steps[0].index
const range = { start: recording.steps[0].ms, end: recording.steps[recording.steps.length - 1].ms }
const lanes: TraceLane[] = [{
  key: 'run',
  density: { label: 'Steps', times: index.times, depths: Uint16Array.from(recording.steps, (s) => s.depth + 1) },
  marks: [{ key: 'console', times: Float64Array.from(recording.console, (m) => m.ms ?? 0), shape: 'dot', tint: 'var(--primary)' }],
}]

const NAVIGATION: Partial<Record<DebugToolbarAction, NavigationKind>> = {
  continue: 'continue',
  'step-over': 'stepOver',
  'step-into': 'stepIn',
  'step-out': 'stepOut',
  'step-back': 'stepInBack',
  'reverse-continue': 'rewind',
}

export interface DebuggerState {
  step: number
  breakpoints: ReadonlySet<number>
  stopped: boolean
}

/** The whole debugger, as a reducer: where an action takes you, from the cache's step table and the lines' hits. */
export function debuggerReducer(state: DebuggerState, action: DebugToolbarAction): DebuggerState {
  if (action === 'stop') return { ...state, stopped: true }
  if (action === 'restart') return { ...state, step: first, stopped: false }
  const how = NAVIGATION[action]
  if (!how || state.stopped) return state
  const breakpoints = [...state.breakpoints].map((line) => ({ sourceId: source.id, line }))
  const next = navigateCached(recording, state.step, how, breakpoints)
  return next < 0 ? state : { ...state, step: next }
}

/** What can't go anywhere from here: the toolbar greys it out. */
function unavailable(state: DebuggerState): DebugToolbarAction[] {
  if (state.stopped) return ['continue', 'step-over', 'step-into', 'step-out', 'step-back', 'reverse-continue', 'stop']
  return (Object.keys(NAVIGATION) as DebugToolbarAction[]).filter((action) => debuggerReducer(state, action) === state)
}

// Controlled: this component holds the step, and the toolbar, the timeline and the code are views of it. Set a
// breakpoint in the gutter and Continue goes to its next hit; scrub the timeline and the toolbar's choices follow.
export default function ControlledDebugger() {
  const [state, setState] = useState<DebuggerState>(() => ({ step: recording.hits[source.id][24][0], breakpoints: new Set([24, 42]), stopped: false }))
  const here = index.step(state.step)!
  const dispatch = useCallback((action: DebugToolbarAction) => setState((s) => debuggerReducer(s, action)), [])
  const toggle = useCallback((line: number) => setState((s) => {
    const breakpoints = new Set(s.breakpoints)
    if (!breakpoints.delete(line)) breakpoints.add(line)
    return { ...s, breakpoints }
  }), [])
  const seek = useCallback((time: number) => {
    const ordinal = index.ordinalAt(time)
    setState((s) => ({ ...s, stopped: false, step: recording.steps[Math.max(0, ordinal)].index }))
  }, [])

  const gutters = useMemo<CodeEditorGutter[]>(() => [{
    id: 'breakpoint',
    width: 16,
    clickable: (line) => source.breakableLines.includes(line),
    onClick: (_event, { line }) => toggle(line),
    label: (line) => `${state.breakpoints.has(line) ? 'Remove' : 'Add'} a breakpoint on line ${line}`,
    className: 'group',
    render: (line) => source.breakableLines.includes(line)
      ? <span className={cn('size-[9px] rounded-full', state.breakpoints.has(line) ? 'bg-warning' : 'bg-warning/50 opacity-0 group-hover:opacity-100')} />
      : null,
  }], [state.breakpoints, toggle])

  const values = bindingsAt(here, 6)
  return (
    <div className="@container mx-auto flex h-[480px] w-full max-w-3xl flex-col overflow-hidden rounded-card border border-border">
      <div className="flex shrink-0 flex-col-reverse gap-2 border-b border-border bg-card p-2 @lg:h-[60px] @lg:flex-row @lg:items-center @lg:gap-3 @lg:px-3 @lg:py-0">
        <div className="min-w-0 flex-1 font-mono text-caption">
          <div className="truncate text-foreground">{source.url}</div>
          <div className="truncate text-caption2 text-muted-foreground">
            {state.stopped ? 'session stopped' : `paused in ${here.stack[0]?.name} at ${here.location.line}:${here.location.column}, step ${here.index}`}
          </div>
        </div>
        <DebugToolbar onAction={dispatch} disabledActions={unavailable(state)} size="sm" className="self-center @lg:self-auto" />
      </div>
      <TraceTimeline
        aria-label="Recording"
        range={range}
        lanes={lanes}
        value={here.ms}
        onValueChange={seek}
        gutter={0}
        className="shrink-0"
      />
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_7rem] border-t border-border @lg:grid-cols-[minmax(0,1fr)_12rem] @lg:grid-rows-1">
        <CodeEditor
          readOnly
          variant="plain"
          lines={LINES}
          aria-label={source.url}
          gutters={gutters}
          currentLine={state.stopped ? undefined : here.location.line}
          currentColumn={state.stopped ? undefined : here.location.column}
          className="h-full"
        />
        <div className="min-h-0 overflow-y-auto border-t border-border px-3 py-2 font-mono text-caption2 @lg:border-s @lg:border-t-0">
          <p className="mb-1 font-sans text-caption text-muted-foreground">{here.stack[0]?.name}</p>
          <dl>
            {values.map((v) => (
              <div key={v.name} className="flex gap-2 py-0.5">
                <dt className="text-muted-foreground">{v.name}</dt>
                <dd className="truncate text-foreground">{v.text}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  )
}
