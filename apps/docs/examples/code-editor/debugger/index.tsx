import { useCallback, useMemo, useState } from 'react'
import { Dialog } from 'react-aria-components'
import { Button } from '@/components/ui/button'
import { CodeEditor, type CodeEditorGutter, type CodeEditorMarker } from '@/components/ui/code-editor'
import { DebugToolbar, type DebugToolbarAction } from '@/components/ui/debug-toolbar'
import { Popover, PopoverTrigger } from '@/components/ui/popover'
import { splitCodeLines } from '@/lib/code-editor-model'
import { Icon } from '@/lib/icon'
import { ThemeScope } from '@/lib/theme'
import { cn } from '@/lib/utils'

const LINES = splitCodeLines(`function dispatch(action) {
  if (typeof action?.type !== 'string') {
    throw new TypeError('Actions need a type');
  }
  const previous = state;
  state = reducer(previous, action);
  history.push({ action, at: history.length });
  if (history.length > MAX_HISTORY) history.shift();
  for (const listener of listeners) {
    listener(state, previous);
  }
  return action;
}

dispatch({ type: 'todos/add', text: 'Ship it' });
dispatch({ type: 'todos/toggle', id: 1 });`)

// What a host knows from its engine: how many times each line ran, and where a line
// has statements to stop at. Nothing in CodeEditor knows what either of these means.
const HITS: Record<number, number> = { 1: 2, 2: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2, 10: 5, 12: 2, 15: 1, 16: 1 }
const NEVER_RAN = new Set([3])
const SITES: Record<number, number[]> = { 6: [2, 10], 7: [2, 10], 8: [2, 6, 36] }

const ranAtLeastOnce = (line: number) => (HITS[line] ?? 0) > 0
const canBreak = (line: number) => line in HITS || NEVER_RAN.has(line)
const jumpLabel = (line: number) => `Jump to line ${line}`

/** Press a hit count: arrows back and forth through that line's executions, or type which one. */
function HitCount({ line, hit, onGo }: { line: number; hit: number; onGo: (line: number, hit: number) => void }) {
  const hits = HITS[line]
  return (
    <PopoverTrigger>
      <Button
        variant="ghost"
        aria-label={`Line ${line} ran ${hits} times`}
        className="h-full w-full rounded-none bg-transparent px-1 font-mono text-caption2 font-normal text-muted-foreground data-hovered:bg-secondary data-hovered:text-foreground"
      >
        <span className="ml-auto">{hits}</span>
      </Button>
      <Popover placement="bottom start" offset={4} className="w-auto">
        <Dialog aria-label={`Executions of line ${line}`} className="flex items-center gap-1 p-1.5 outline-none">
          <Button size="icon-sm" variant="quiet" aria-label="Previous execution" isDisabled={hit <= 1} onPress={() => onGo(line, hit - 1)}>
            <Icon name="chevron-left" size={14} />
          </Button>
          <input
            aria-label="Execution number"
            inputMode="numeric"
            placeholder="–"
            value={hit || ''}
            onChange={(e) => {
              const value = Number(e.target.value)
              if (Number.isInteger(value) && value >= 1 && value <= hits) onGo(line, value)
            }}
            className="h-7 w-12 rounded-ctl border-0 bg-secondary text-center font-mono text-caption text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <span className="pr-1 font-mono text-caption text-muted-foreground">of {hits}</span>
          <Button size="icon-sm" variant="quiet" aria-label="Next execution" isDisabled={hit >= hits} onPress={() => onGo(line, hit + 1)}>
            <Icon name="chevron-right" size={14} />
          </Button>
        </Dialog>
      </Popover>
    </PopoverTrigger>
  )
}

export default function Debugger() {
  const [position, setPosition] = useState({ line: 6, column: 2, hit: 1 })
  const [breakpoints, setBreakpoints] = useState(() => new Set([6, 10]))
  const [sites, setSites] = useState(() => new Set(['7:10']))
  const [sessionStopped, setSessionStopped] = useState(false)

  const go = useCallback((line: number, hit: number) => setPosition({ line, column: SITES[line]?.[0] ?? 0, hit }), [])
  const jump = useCallback((line: number) => go(line, 1), [go])
  const onDebugAction = useCallback((action: DebugToolbarAction) => {
    if (action === 'stop') {
      setSessionStopped(true)
      return
    }
    if (action === 'restart') {
      setSessionStopped(false)
      setPosition({ line: 6, column: 2, hit: 1 })
      return
    }
    const direction = action === 'step-back' || action === 'reverse-continue' ? -1 : 1
    const lines = (action === 'continue' || action === 'reverse-continue'
      ? [...breakpoints]
      : Object.keys(HITS).map(Number)
    ).sort((a, b) => a - b)
    const candidates = direction > 0 ? lines : [...lines].reverse()
    const nextLine = candidates.find((line) => direction > 0 ? line > position.line : line < position.line)
    if (nextLine !== undefined) {
      setSessionStopped(false)
      go(nextLine, Math.min(position.hit, HITS[nextLine] ?? 1))
    }
  }, [breakpoints, go, position.line, position.hit])
  const toggle = useCallback((line: number) => {
    setBreakpoints((set) => {
      const next = new Set(set)
      if (!next.delete(line)) next.add(line)
      return next
    })
  }, [])

  // Memoized, so a step only redraws the rows that changed.
  const gutters = useMemo<CodeEditorGutter[]>(() => [
    {
      id: 'hits',
      width: 34,
      align: 'end',
      render: (line) => (HITS[line] ? <HitCount line={line} hit={position.line === line ? position.hit : 0} onGo={go} /> : null),
    },
    {
      id: 'breakpoint',
      width: 16,
      onPress: toggle,
      isPressable: canBreak,
      label: (line) => `${breakpoints.has(line) ? 'Remove' : 'Add'} a breakpoint on line ${line}`,
      className: 'group',
      render: (line) => canBreak(line)
        ? <span className={cn('size-[9px] rounded-full', breakpoints.has(line) ? 'bg-warning' : 'bg-warning/50 opacity-0 group-data-hovered:opacity-100')} />
        : null,
    },
  ], [breakpoints, go, position.line, position.hit, toggle])

  const markers = useCallback((line: number): CodeEditorMarker[] | undefined => SITES[line]?.map((column) => ({
    column,
    label: `Breakpoint at line ${line}, column ${column}`,
    isActive: sites.has(`${line}:${column}`),
    onPress: () => setSites((set) => {
      const next = new Set(set)
      if (!next.delete(`${line}:${column}`)) next.add(`${line}:${column}`)
      return next
    }),
  })), [sites])

  const lineDecoration = useCallback((line: number) => (NEVER_RAN.has(line) ? { textClassName: 'opacity-45' } : null), [])

  // The ThemeScope is only here so the portalled popover wears this demo's light / dark appearance.
  return (
    <ThemeScope className="mx-auto w-full max-w-2xl">
      <div className="flex h-[360px] flex-col overflow-hidden rounded-card border border-border">
        <div className="flex h-[60px] shrink-0 items-center gap-3 border-b border-border bg-card px-3">
          <div className="min-w-0 flex-1 font-mono text-caption">
            <div className="truncate text-foreground">store.js</div>
            <div className="truncate text-caption2 text-muted-foreground">
              {sessionStopped ? 'session stopped' : `paused at ${position.line}:${position.column}, run ${position.hit}`}
            </div>
          </div>
          <DebugToolbar
            onAction={onDebugAction}
            disabledActions={sessionStopped ? ['continue', 'step-over', 'step-into', 'step-out', 'step-back', 'reverse-continue', 'stop'] : []}
            className="ml-auto"
          />
        </div>
        <div className="min-h-0 flex-1">
          <CodeEditor
            readOnly
            variant="ghost"
            lines={LINES}
            aria-label="store.js"
            gutters={gutters}
            currentLine={position.line}
            currentColumn={position.column}
            lineDecoration={lineDecoration}
            markers={markers}
            onLineNumberPress={jump}
            isLineNumberPressable={ranAtLeastOnce}
            lineNumberLabel={jumpLabel}
          />
        </div>
      </div>
    </ThemeScope>
  )
}
