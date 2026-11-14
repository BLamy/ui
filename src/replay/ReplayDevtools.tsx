/* The player's DevTools: a Console and a Network button in the top bar, with what had happened by the playhead —
   requests sent and, in red, how many had failed; console errors in red — and, behind them, a panel over the
   page in the manner of Chrome's DevTools. The Console lists what had been logged, warnings and errors on their
   tinted rows with their stack traces; the Network tab lists the requests that had been sent (a request still
   waiting at the playhead shows as pending), and a request's row opens its headers, payload and response.

   Everything is a function of the playhead: scrub back and the lists shrink to what DevTools showed then. A row's
   time jumps the player there. Esc closes the panel. An inspection (inspections.ts) selects its request or
   message and marks it.

   Its controls are UI SDK's: toggles for the two buttons, tabs for the panels and a request's details, a select
   and a segmented control in the toolbars, collapsibles for stack traces and header sections, and a tree for the
   Elements pane. The docked panel with its resize separator and the Network table's selectable rows are primitives
   of UI SDK's core (devtools-primitives.ts). Plain CSS, like the player. */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { createStickToBottom } from '@ui-sdk/core'
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@ui-sdk/react/collapsible'
import { SegmentedControl, SegmentedControlItem } from '@ui-sdk/react/segmented-control'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@ui-sdk/react/select'
import { Toggle, ToggleGroup } from '@ui-sdk/react/toggle'
import { Tree, TreeGroup, TreeItem, TreeItemIndicator, TreeItemLabel } from '@ui-sdk/react/tree'
import { ChevronDown, ChevronRight, CircleX, Info, Network, SquareTerminal, TriangleAlert, X } from 'lucide-react'
import { DevtoolsPanelResize, DevtoolsPanelRoot, RequestRow, RequestTable, Tabs, TabsList, TabsPanel, TabsTab } from './devtools-parts'
import type { ReplayConsoleEntry, ReplayDevtoolsState, ReplayRequest } from './devtools'
import { sourceName, type ResolvedReplayEvidence } from './evidence'
import type { ResolvedReplayInspection } from './inspections'

export type ReplayDevtoolsTab = 'console' | 'network' | 'elements' | 'sources'

/** How many rows a pane lays out, keeping the latest. It has no windowing, and this list can be an hour long. */
const MAX_ROWS = 2000

const time = (ms: number) => {
  const s = Math.max(0, ms) / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}
const duration = (ms?: number) => (ms === undefined ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`)

/** The two buttons for the top bar (or the controls row): icon, request count and, in red, what failed. */
export function DevtoolsButtons({ counts, open, onOpen }: {
  counts: ReplayDevtoolsState['counts']; open: ReplayDevtoolsTab | null; onOpen: (tab: ReplayDevtoolsTab) => void
}) {
  const { requests, failed, errors, warnings } = counts
  // One of the two is pressed while its tab is the open one; pressing it again closes the panel.
  return (
    <ToggleGroup
      data-part="replay-devtools-buttons"
      aria-label="DevTools"
      value={open === 'console' || open === 'network' ? [open] : []}
      onValueChange={(next) => {
        const pressed = (next[0] ?? open) as ReplayDevtoolsTab | null
        if (pressed) onOpen(pressed)
      }}
    >
      <Toggle
        value="console"
        data-part="replay-devtools-button"
        data-tab="console"
        aria-label={`Console: ${errors} ${errors === 1 ? 'error' : 'errors'}, ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`}
        title="Console"
      >
        <SquareTerminal size={14} strokeWidth={2} aria-hidden="true" />
        {errors ? <span data-part="failed">{errors}</span> : null}
        {warnings ? <span data-part="warn">{warnings}</span> : null}
      </Toggle>
      <Toggle
        value="network"
        data-part="replay-devtools-button"
        data-tab="network"
        aria-label={`Network: ${requests} ${requests === 1 ? 'request' : 'requests'}, ${failed} failed`}
        title="Network"
      >
        <Network size={14} strokeWidth={2} aria-hidden="true" />
        <span data-part="count">{requests}</span>
        {failed ? <span data-part="failed">{failed}</span> : null}
      </Toggle>
    </ToggleGroup>
  )
}

/** The panel over the page: Console and Network, cut at the playhead. `inspection` selects and marks its target;
 *  `autoFocus` (default true) moves focus into the panel as it opens — off when an inspection opened it mid-play.
 *  A named region docked inside the stage (not a dialog: it's part of the player, and the page stays in reach). */
export function DevtoolsPanel({ state, tab, onTab, onClose, onSeek, inspection, autoFocus = true, onInteract, elements, sources }: {
  state: ReplayDevtoolsState; tab: ReplayDevtoolsTab; onTab: (tab: ReplayDevtoolsTab) => void
  onClose: () => void; onSeek: (ms: number) => void; inspection?: ResolvedReplayInspection | null; autoFocus?: boolean
  /** Any click, scroll or key in the panel (the player then treats it as the user's). */
  onInteract?: () => void
  /** The Elements tab: the replayed page's document, the selected element, and selection / hover callbacks. */
  elements?: ElementsProps
  /** The Sources tab: the debugger's source excerpts and logpoints. */
  sources?: SourcesProps
}) {
  const panel = useRef<HTMLElement>(null)
  // Opened by an inspection, the panel starts taller: its point is the request's details.
  const [startSize] = useState(inspection ? 72 : 58)
  // Focus moves in as the panel opens (not later, when the user is already working in it).
  useEffect(() => { if (autoFocus) panel.current?.focus({ preventScroll: true }) }, [])

  const onKeyDown = (e: ReactKeyboardEvent) => {
    onInteract?.()
    const target = e.target as HTMLElement
    if (e.key === 'Escape') {
      // An open list inside the panel (the level select's) closes on its own Escape, which it hears after this.
      if (target.closest('[popover], [aria-haspopup][aria-expanded="true"]')) return
      e.stopPropagation()
      onClose()
    }
    // The player's own keys (space, arrows, J/K/L) stay out of the panel.
    else if (!target.closest('input')) e.stopPropagation()
  }

  const tabs: { id: ReplayDevtoolsTab; label: string }[] = [
    ...(elements ? [{ id: 'elements' as const, label: 'Elements' }] : []),
    { id: 'console', label: 'Console' },
    ...(sources ? [{ id: 'sources' as const, label: 'Sources' }] : []),
    { id: 'network', label: 'Network' },
  ]
  // A tab that has gone (Elements without a document) falls back to Network, as before.
  const shown: ReplayDevtoolsTab = tab === 'elements' && !elements ? 'network' : tab === 'sources' && !sources ? 'network' : tab
  return (
    <DevtoolsPanelRoot
      ref={panel}
      defaultSize={startSize}
      aria-label="DevTools"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      onPointerDown={onInteract}
      onWheel={onInteract}
    >
      <DevtoolsPanelResize aria-label="Resize DevTools" />
      <Tabs value={shown} onValueChange={(next) => { if (next) onTab(next as ReplayDevtoolsTab) }}>
        <div data-slot="replay-devtools-tabs">
          <TabsList data-part="replay-devtools-tablist" aria-label="DevTools panels">
            {tabs.map((t) => (
              <TabsTab key={t.id} value={t.id}>
                {t.label}
                {t.id === 'console' && state.counts.errors ? <span data-part="failed">{state.counts.errors}</span> : null}
                {t.id === 'network' && state.counts.failed ? <span data-part="failed">{state.counts.failed}</span> : null}
              </TabsTab>
            ))}
          </TabsList>
          <button type="button" data-slot="replay-devtools-close" aria-label="Close DevTools" onClick={onClose}><X size={14} aria-hidden="true" /></button>
        </div>
        {shown === 'console'
          ? <ConsolePane state={state} onSeek={onSeek} inspected={inspection?.tab === 'console' ? inspection : null} />
          : shown === 'elements' && elements ? <ElementsPane {...elements} />
          : shown === 'sources' && sources ? <SourcesPane {...sources} />
          : <NetworkPane state={state} onSeek={onSeek} inspected={inspection?.tab === 'network' ? inspection : null} />}
      </Tabs>
    </DevtoolsPanelRoot>
  )
}

/* ── Console ─────────────────────────────────────────────────────────────────────── */

type LevelFilter = 'all' | 'error' | 'warn' | 'info'
const LEVEL_ICON = { error: CircleX, warn: TriangleAlert, info: Info } as const
const LEVELS: { value: LevelFilter; label: string }[] = [
  { value: 'all', label: 'All levels' },
  { value: 'error', label: 'Errors' },
  { value: 'warn', label: 'Warnings' },
  { value: 'info', label: 'Info' },
]

function ConsolePane({ state, onSeek, inspected }: {
  state: ReplayDevtoolsState; onSeek: (ms: number) => void; inspected: ResolvedReplayInspection | null
}) {
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<LevelFilter>('all')
  const list = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.console.filter((e) =>
      (level === 'all' || (level === 'info' ? e.level === 'info' || e.level === 'log' || e.level === 'debug' : e.level === level)) &&
      (!q || e.message.toLowerCase().includes(q)))
  }, [state.console, query, level])
  // Follow new messages as they're logged, unless you've scrolled up to read (or an inspection is showing one).
  const [stick] = useState(() => createStickToBottom({ threshold: 8 }))
  useEffect(() => (list.current ? stick.connect(list.current) : undefined), [stick])
  const inspectedId = inspected?.messageId
  const shown = inspectedId !== undefined && rows.some((r) => r.id === inspectedId)
  useEffect(() => {
    if (!shown) return
    stick.release()
    list.current?.querySelector('[data-inspected]')?.scrollIntoView?.({ block: 'nearest' })
  }, [shown, inspected?.id, stick])
  return (
    <TabsPanel value="console" data-part="replay-devtools-pane" data-pane="console">
      <div data-slot="replay-devtools-toolbar">
        <input type="search" aria-label="Filter console" placeholder="Filter" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        <Select items={LEVELS} value={level} onValueChange={(next) => { if (next) setLevel(next as LevelFilter) }}>
          <SelectTrigger aria-label="Log levels">
            <SelectValue />
            <ChevronDown size={12} data-part="caret" aria-hidden="true" />
          </SelectTrigger>
          <SelectContent sideOffset={3}>
            {LEVELS.map((l) => <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span data-part="summary">
          {state.counts.errors ? <span data-part="failed">{state.counts.errors} {state.counts.errors === 1 ? 'error' : 'errors'}</span> : null}
          {state.counts.warnings ? <span data-part="warn">{state.counts.warnings} {state.counts.warnings === 1 ? 'warning' : 'warnings'}</span> : null}
        </span>
      </div>
      <div ref={list} data-slot="replay-devtools-list" role="log" aria-label="Console messages">
        {/* One child that grows with the log: what the follower watches. */}
        <div data-part="rows">
          {rows.length > MAX_ROWS ? <p data-slot="replay-devtools-later">{rows.length - MAX_ROWS} earlier messages aren&apos;t shown here</p> : null}
          {rows.slice(-MAX_ROWS).map((entry) => <ConsoleRow key={entry.id} entry={entry} onSeek={onSeek} inspected={entry.id === inspectedId} />)}
          {!rows.length ? <p data-slot="replay-devtools-empty">{state.console.length ? 'No messages match the filter' : 'Nothing logged yet'}</p> : null}
          {state.counts.laterMessages ? <p data-slot="replay-devtools-later">{state.counts.laterMessages} more later in the recording</p> : null}
        </div>
      </div>
    </TabsPanel>
  )
}

function ConsoleRow({ entry, onSeek, inspected }: { entry: ReplayConsoleEntry; onSeek: (ms: number) => void; inspected: boolean }) {
  const Glyph = entry.level === 'error' || entry.level === 'warn' || entry.level === 'info' ? LEVEL_ICON[entry.level] : null
  const body = (
    <>
      <span data-part="icon" aria-hidden="true">{Glyph ? <Glyph size={12} strokeWidth={2.2} /> : null}</span>
      <span data-part="message">{entry.message || ' '}</span>
    </>
  )
  return (
    <div data-slot="replay-devtools-message" data-level={entry.level} data-inspected={inspected || undefined}>
      {entry.trace?.length ? (
        <Collapsible data-part="entry">
          <CollapsibleTrigger data-part="line">{body}</CollapsibleTrigger>
          <CollapsiblePanel render={<ol />} data-part="trace">{entry.trace.map((frame, i) => <li key={i}>{frame}</li>)}</CollapsiblePanel>
        </Collapsible>
      ) : <div data-part="line">{body}</div>}
      <button type="button" data-part="time" aria-label={`Go to ${time(entry.time)}`} onClick={() => onSeek(entry.time)}>{time(entry.time)}</button>
    </div>
  )
}

/* ── Network ─────────────────────────────────────────────────────────────────────── */

type RequestFilter = 'all' | 'fetch' | 'failed'
type Row = ReplayRequest & { pending: boolean }
const REQUEST_FILTERS: { value: RequestFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'fetch', label: 'Fetch/XHR' },
  { value: 'failed', label: 'Failed' },
]

const statusText = (r: Row) => (r.pending ? '(pending)' : r.status === undefined ? (r.failed ? '(failed)' : '—') : r.status === 0 ? '(failed)' : String(r.status))

function NetworkPane({ state, onSeek, inspected }: {
  state: ReplayDevtoolsState; onSeek: (ms: number) => void; inspected: ResolvedReplayInspection | null
}) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RequestFilter>('all')
  const inspectedId = inspected?.requestId
  const [selectedId, setSelectedId] = useState<string | null>(inspectedId ?? null)
  const table = useRef<HTMLDivElement>(null)
  // A new inspection selects its request (once it has been sent) and brings its row into view.
  useEffect(() => { if (inspectedId) setSelectedId(inspectedId) }, [inspected?.id, inspectedId])
  const sent = inspectedId !== undefined && state.network.some((r) => r.id === inspectedId)
  useEffect(() => {
    if (sent) table.current?.querySelector('[data-inspected]')?.scrollIntoView?.({ block: 'nearest' })
  }, [sent, inspected?.id])
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.network.filter((r) =>
      (filter === 'all' || (filter === 'failed' ? r.failed && !r.pending : r.type === 'fetch' || r.type === 'xhr')) &&
      (!q || r.url.toLowerCase().includes(q) || r.method.toLowerCase() === q))
  }, [state.network, query, filter])
  const selected = state.network.find((r) => r.id === selectedId) ?? null
  // The waterfall spans from the first request to the last answer seen by the playhead.
  const span = useMemo(() => {
    const first = state.network[0]?.time ?? 0
    let last = first + 1
    for (const r of state.network) last = Math.max(last, r.time + (r.duration ?? 0))
    return { first, length: last - first }
  }, [state.network])

  return (
    <TabsPanel value="network" data-part="replay-devtools-pane" data-pane="network" data-detail={selected ? '' : undefined}>
      <div data-slot="replay-devtools-toolbar">
        <input type="search" aria-label="Filter requests" placeholder="Filter" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        <SegmentedControl
          data-part="replay-devtools-chips"
          aria-label="Request types"
          value={filter}
          onValueChange={(next) => { if (next) setFilter(next as RequestFilter) }}
        >
          {REQUEST_FILTERS.map((f) => <SegmentedControlItem key={f.value} value={f.value}>{f.label}</SegmentedControlItem>)}
        </SegmentedControl>
      </div>
      <div data-slot="replay-devtools-network">
        <div ref={table} data-slot="replay-devtools-table-wrap">
          <RequestTable aria-label="Requests" value={selectedId} onValueChange={setSelectedId}>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                {selected ? null : <><th scope="col">Method</th><th scope="col">Type</th><th scope="col">Time</th><th scope="col" data-col="waterfall">Waterfall</th></>}
              </tr>
            </thead>
            <tbody>
              {rows.slice(-MAX_ROWS).map((r) => (
                <RequestRow
                  key={r.id}
                  value={r.id}
                  data-failed={(r.failed && !r.pending) || undefined}
                  data-pending={r.pending || undefined}
                  data-inspected={r.id === inspectedId || undefined}
                >
                  <td title={r.url}><span data-part="name">{r.name}</span></td>
                  <td>{statusText(r)}</td>
                  {selected ? null : (
                    <>
                      <td>{r.method}</td>
                      <td>{r.type}</td>
                      <td>{r.pending ? 'Pending' : duration(r.duration)}</td>
                      <td data-col="waterfall">
                        <span
                          data-part="bar"
                          style={{
                            left: `${((r.time - span.first) / span.length) * 100}%`,
                            width: `max(2px, ${(((r.duration ?? 0) / span.length) * 100).toFixed(2)}%)`,
                          }}
                        />
                      </td>
                    </>
                  )}
                </RequestRow>
              ))}
            </tbody>
          </RequestTable>
          {!rows.length ? <p data-slot="replay-devtools-empty">{state.network.length ? 'No requests match the filter' : 'No requests yet'}</p> : null}
          {rows.length > MAX_ROWS ? <p data-slot="replay-devtools-later">{rows.length - MAX_ROWS} earlier requests aren&apos;t shown here</p> : null}
        </div>
        {selected ? <RequestDetail request={selected} onClose={() => setSelectedId(null)} onSeek={onSeek} /> : null}
      </div>
    </TabsPanel>
  )
}

const DETAIL_TABS = ['headers', 'payload', 'response'] as const

function RequestDetail({ request, onClose, onSeek }: { request: Row; onClose: () => void; onSeek: (ms: number) => void }) {
  const general: [string, string][] = [
    ['Request URL', request.url],
    ['Request Method', request.method],
    ['Status Code', request.pending ? 'Pending' : request.status !== undefined ? `${request.status}${request.statusText ? ` ${request.statusText}` : ''}` : request.failed ? 'Failed' : 'Unknown'],
    ...(request.error ? [['Error', request.error] as [string, string]] : []),
    ['Sent at', time(request.time)],
    ['Duration', duration(request.duration)],
  ]
  return (
    <div data-slot="replay-devtools-detail">
      <Tabs defaultValue="headers">
        <div data-slot="replay-devtools-detail-tabs">
          <button type="button" aria-label="Close request details" data-slot="replay-devtools-close" onClick={onClose}><X size={13} aria-hidden="true" /></button>
          <TabsList data-part="replay-devtools-tablist" aria-label={`${request.name} details`}>
            {DETAIL_TABS.map((t) => <TabsTab key={t} value={t}>{t[0]!.toUpperCase() + t.slice(1)}</TabsTab>)}
          </TabsList>
        </div>
        <TabsPanel value="headers" data-part="replay-devtools-detail-body">
          <Section title="General" rows={general} />
          {request.responseHeaders ? <Section title="Response Headers" rows={Object.entries(request.responseHeaders)} /> : null}
          {request.requestHeaders ? <Section title="Request Headers" rows={Object.entries(request.requestHeaders)} /> : null}
          <button type="button" data-slot="replay-devtools-jump" onClick={() => onSeek(request.time)}>Go to {time(request.time)} in the recording</button>
        </TabsPanel>
        <TabsPanel value="payload" data-part="replay-devtools-detail-body">
          <Body text={request.requestBody} empty="This request has no recorded payload" />
        </TabsPanel>
        <TabsPanel value="response" data-part="replay-devtools-detail-body">
          <Body text={request.responseBody} empty={request.pending ? 'Waiting for the response' : 'The recording has no response body for this request'} />
        </TabsPanel>
      </Tabs>
    </div>
  )
}

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <Collapsible defaultOpen data-part="replay-devtools-section">
      <CollapsibleTrigger><ChevronRight size={12} data-part="chevron" aria-hidden="true" />{title}</CollapsibleTrigger>
      <CollapsiblePanel render={<dl />}>
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </CollapsiblePanel>
    </Collapsible>
  )
}

const HIGHLIGHT_MAX = 64 * 1024

type Span = { type: string; start: number; end: number }

/** gpu-lexer's spans for `text` (loaded on first use; the same model and token colors as docstream's code blocks):
 *  null until they arrive, for empty text, and past 64 KB. */
function useSpans(text: string | undefined): Span[] | null {
  const [spans, setSpans] = useState<{ for: string; spans: Span[] } | null>(null)
  useEffect(() => {
    if (text === undefined || !text || text.length > HIGHLIGHT_MAX) return
    let cancelled = false
    import('gpu-lexer')
      .then(({ parse }) => parse(text))
      .then((result: Span[]) => { if (!cancelled) setSpans({ for: text, spans: result }) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [text])
  return spans && spans.for === text ? spans.spans : null
}

/** JSON reads indented; anything else as it was sent. */
const pretty = (body?: string) => {
  if (body === undefined || body === '') return undefined
  try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
}

/** A request or response body, syntax-highlighted. Plain until the spans arrive. A <div> of spans, not
 *  <pre><code>, so a host's code-block styles (cards, margins, inline-code pills) can't reach it. */
function Body({ text: raw, empty }: { text?: string; empty: string }) {
  const text = useMemo(() => pretty(raw), [raw])
  const spans = useSpans(text)
  if (text === undefined) return <p data-slot="replay-devtools-empty">{empty}</p>
  return (
    <div data-slot="replay-devtools-body">
      {spans ? highlight(text, spans) : text}
    </div>
  )
}

function highlight(code: string, spans: Span[], offset = 0) {
  const out: ReactNode[] = []
  let cursor = 0
  spans.forEach((span, i) => {
    const start = Math.max(span.start - offset, 0)
    const end = Math.min(span.end - offset, code.length)
    if (end <= start) return
    if (start > cursor) out.push(code.slice(cursor, start))
    const piece = code.slice(start, end)
    out.push(span.type === 'plain' ? piece : <span key={i} className={`docs-tok docs-tok-${span.type}`}>{piece}</span>)
    cursor = end
  })
  if (cursor < code.length) out.push(code.slice(cursor))
  return out
}

/** Spans for the excerpt's lines by line number, lexed as one text (so a line reads in its neighbours' context) and
 *  cut back into lines. */
function lineSpans(lines: { line: number; text: string }[], spans: Span[] | null) {
  if (!spans) return null
  const out = new Map<number, { offset: number; spans: Span[] }>()
  let offset = 0
  for (const { line, text } of lines) {
    const start = offset
    out.set(line, { offset: start, spans: spans.filter((s) => s.end > start && s.start < start + text.length) })
    offset += text.length + 1
  }
  return out
}

/* ── Elements ────────────────────────────────────────────────────────────────────── */

export interface ElementsProps {
  /** The replayed page's document, read fresh on every render (the page changes as it plays). */
  getDocument: () => Document | null
  /** The selected element (an inspection's, or the one clicked in the tree). */
  selected: Element | null
  onSelect: (el: Element) => void
  /** Hovering a row highlights its element on the page; null when the pointer leaves the tree. */
  onHover: (el: Element | null) => void
}

const MAX_CHILDREN = 300

/** An attribute's value as the page wrote it: rrweb's own markers (`:hover` classes for replayed hover state,
 *  `rrweb-*` classes) are left out. Null when nothing is left of a class attribute. */
function pageValue(name: string, value: string): string | null {
  if (name !== 'class') return value
  const kept = value.split(/\s+/).filter((c) => c && !c.startsWith(':') && !c.startsWith('rrweb-') && !c.startsWith('rr_'))
  return kept.length ? kept.join(' ') : null
}

/** A row of the tree as it stands now: the page is read once per render, then drawn from this. */
type NodeRow =
  | { kind: 'text'; id: string; text: string }
  | {
      kind: 'element'; id: string; el: Element; tag: string; attrs: [string, string][]
      /** Whether it has children to open (a lone short text child shows inline instead). */
      branch: boolean; open: boolean; inlineText: string | null; children: NodeRow[]; more: number
    }

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s)

/** The replayed page's DOM as a tree, Chrome's Elements panel in miniature. Branches render their children only
 *  while open, so a large page costs what's showing. */
function ElementsPane({ getDocument, selected, onSelect, onHover }: ElementsProps) {
  const doc = getDocument()
  const root = doc?.documentElement ?? null
  // Expanded nodes (live DOM nodes, so the tree survives the page mutating under it).
  const [expanded] = useState(() => new Set<Node>())
  const [, bump] = useState(0)
  // The tree names its items by string: one id per node, for as long as the node lives.
  const [ids] = useState(() => ({ of: new WeakMap<Node, string>(), next: 0 }))
  const idOf = (node: Node) => {
    let id = ids.of.get(node)
    if (!id) ids.of.set(node, (id = `node-${++ids.next}`))
    return id
  }
  // A new selection opens its ancestors and scrolls into view.
  const tree = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!selected) return
    for (let n: Node | null = selected.parentNode; n && n !== doc; n = n.parentNode) expanded.add(n)
    bump((n) => n + 1)
    requestAnimationFrame(() => tree.current?.querySelector('[data-slot="tree-label"][data-selected]')?.scrollIntoView?.({ block: 'nearest' }))
  }, [selected, doc, expanded])

  if (!root) return <TabsPanel value="elements" data-part="replay-devtools-pane" data-pane="elements"><p data-slot="replay-devtools-empty">The page isn't loaded yet</p></TabsPanel>

  // The rows that show, and the nodes behind them (rebuilt on every render, as the page changes under it).
  const shown = new Map<string, Node>()
  const open: string[] = []
  const read = (node: Node): NodeRow | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, ' ').trim()
      if (!text) return null
      const id = idOf(node)
      shown.set(id, node)
      return { kind: 'text', id, text: clip(text, 140) }
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null
    const el = node as Element
    const id = idOf(el)
    shown.set(id, el)
    const kids = [...el.childNodes].filter((c) => c.nodeType === Node.ELEMENT_NODE || (c.nodeType === Node.TEXT_NODE && c.textContent?.trim()))
    // A lone short text child shows inline, as Chrome does.
    const inlineText = kids.length === 1 && kids[0]!.nodeType === Node.TEXT_NODE && (kids[0]!.textContent?.trim().length ?? 0) <= 80 ? kids[0]!.textContent!.trim() : null
    const branch = kids.length > 0 && inlineText === null
    const isOpen = branch && expanded.has(el)
    if (isOpen) open.push(id)
    return {
      kind: 'element', id, el, tag: el.tagName.toLowerCase(),
      attrs: [...el.attributes].flatMap((a) => {
        const value = pageValue(a.name, a.value)
        return value === null ? [] : [[a.name, value] as [string, string]]
      }),
      branch, open: isOpen, inlineText,
      children: isOpen ? kids.slice(0, MAX_CHILDREN).flatMap((child) => read(child) ?? []) : [],
      more: isOpen ? Math.max(0, kids.length - MAX_CHILDREN) : 0,
    }
  }
  const top = read(root)
  const elementOf = (id: string | null | undefined) => {
    const node = id ? shown.get(id) : undefined
    return node && node.nodeType === Node.ELEMENT_NODE ? (node as Element) : null
  }

  const row = (r: NodeRow): ReactNode => {
    if (r.kind === 'text') {
      return (
        <TreeItem key={r.id} value={r.id}>
          <TreeItemLabel data-part="replay-devtools-node" data-kind="text">{r.text}</TreeItemLabel>
        </TreeItem>
      )
    }
    const { tag } = r
    return (
      <TreeItem key={r.id} value={r.id} branch={r.branch} label={tag}>
        <TreeItemLabel data-part="replay-devtools-node" data-kind="element" onPointerEnter={() => onHover(r.el)}>
          {r.branch ? <TreeItemIndicator data-part="twisty"><ChevronRight size={11} /></TreeItemIndicator> : <span data-part="twisty" />}
          <span data-part="tag">&lt;{tag}</span>
          {r.attrs.map(([name, value]) => (
            <span key={name} data-part="attr">
              {' '}<span data-part="attr-name">{name}</span>{value !== '' ? <>=&quot;<span data-part="attr-value">{clip(value, 80)}</span>&quot;</> : null}
            </span>
          ))}
          <span data-part="tag">&gt;</span>
          {r.inlineText !== null ? <><span data-part="text">{clip(r.inlineText, 80)}</span><span data-part="tag">&lt;/{tag}&gt;</span></> : null}
          {r.branch && !r.open ? <><span data-part="ellipsis">…</span><span data-part="tag">&lt;/{tag}&gt;</span></> : null}
          {!r.branch && r.inlineText === null ? <span data-part="tag">&lt;/{tag}&gt;</span> : null}
        </TreeItemLabel>
        {r.open ? (
          <TreeGroup>
            {r.children.map(row)}
            {r.more ? (
              <TreeItem value={`${r.id}-more`}>
                <TreeItemLabel data-part="replay-devtools-node" data-kind="text">… {r.more} more</TreeItemLabel>
              </TreeItem>
            ) : null}
            <div data-part="replay-devtools-node" data-kind="close" aria-hidden="true"><span data-part="tag">&lt;/{tag}&gt;</span></div>
          </TreeGroup>
        ) : null}
      </TreeItem>
    )
  }

  const path: Element[] = []
  for (let n: Element | null = selected && selected.isConnected ? selected : null; n; n = n.parentElement) path.unshift(n)
  return (
    <TabsPanel value="elements" data-part="replay-devtools-pane" data-pane="elements">
      <div ref={tree} data-slot="replay-devtools-elements" onPointerLeave={() => onHover(null)}>
        <Tree
          aria-label="Elements"
          expandOnPress={false}
          value={selected && selected.isConnected ? idOf(selected) : null}
          // Only an element can be selected, and the page's selection never clears.
          onValueChange={(id, details) => {
            const el = elementOf(id)
            if (el) onSelect(el)
            else details.cancel()
          }}
          expanded={open}
          onExpandedChange={(next) => {
            for (const [id, node] of shown) {
              if (next.includes(id)) expanded.add(node)
              else expanded.delete(node)
            }
            bump((n) => n + 1)
          }}
          // The row the keyboard is on shows on the page, as the hovered one does.
          onHighlight={(id) => onHover(elementOf(id))}
        >
          {top ? row(top) : null}
        </Tree>
      </div>
      {path.length ? (
        <nav data-slot="replay-devtools-breadcrumb" aria-label="Selected element's ancestors">
          {path.map((el, i) => (
            <button key={i} type="button" data-current={el === selected || undefined} aria-current={el === selected || undefined} onClick={() => onSelect(el)} onPointerEnter={() => onHover(el)} onPointerLeave={() => onHover(null)}>
              {crumb(el)}
            </button>
          ))}
        </nav>
      ) : null}
    </TabsPanel>
  )
}

const crumb = (el: Element) => {
  const tag = el.tagName.toLowerCase()
  const id = el.id ? `#${el.id}` : ''
  const classes = pageValue('class', el.getAttribute('class') ?? '')
  const cls = classes ? '.' + classes.split(' ').slice(0, 2).join('.') : ''
  return tag + id + cls
}

/* ── Sources ─────────────────────────────────────────────────────────────────────── */

export interface SourcesProps {
  evidence: ResolvedReplayEvidence
  /** The playhead (ms): which logpoint hit is current. */
  at: number
  /** The file (and line) to show: an inspection's, or the one picked in the list. */
  path: string | null
  line?: number
  onPath: (path: string) => void
}

/** The debugger's view of the source: a file list; the file's lines with their hit counts, the lines it read
 *  highlighted and breakpoints on its logpoints; and a Watch panel with each logpoint's expression and its value at
 *  the playhead (flashing blue as a new hit lands), the line of the latest hit marked in the code. */
function SourcesPane({ evidence, at, path, line, onPath }: SourcesProps) {
  const current = evidence.files.find((f) => f.path === path) ?? evidence.files[0]
  const code = useRef<HTMLDivElement>(null)
  // Each logpoint's latest hit at the playhead, and the latest of those: where the debugger is "paused".
  const watches = evidence.logpoints.map((lp) => {
    const index = lp.hits.filter((h) => h.time <= at).length - 1
    return { lp, index, hit: index >= 0 ? lp.hits[index] : undefined }
  })
  const paused = watches.reduce<(typeof watches)[number] | undefined>((a, w) => (w.hit && (!a?.hit || w.hit.time >= a.hit.time) ? w : a), undefined)
  const pausedLine = paused?.lp.path === current?.path ? paused?.lp.line : undefined
  const target = line ?? pausedLine ?? current?.focus?.[0]
  const sourceSpans = useSpans(current?.lines.map((r) => r.text).join('\n'))
  useEffect(() => {
    if (target === undefined) return
    code.current?.querySelector(`[data-line="${target}"]`)?.scrollIntoView?.({ block: 'center' })
  }, [current?.path, target])
  if (!current) return <TabsPanel value="sources" data-part="replay-devtools-pane" data-pane="sources"><p data-slot="replay-devtools-empty">No sources were read</p></TabsPanel>
  const points = evidence.logpoints.filter((lp) => lp.path === current.path)
  const focus = new Set(current.focus)
  // A logpoint on a line the excerpt doesn't hold still gets a row of its own.
  const rows = [...current.lines]
  for (const lp of points) if (!rows.some((r) => r.line === lp.line)) rows.push({ line: lp.line, text: '' })
  rows.sort((a, b) => a.line - b.line)
  const lexed = lineSpans(current.lines, sourceSpans)
  const digits = String(rows.at(-1)?.line ?? 0).length
  return (
    <TabsPanel value="sources" data-part="replay-devtools-pane" data-pane="sources">
      <div data-slot="replay-devtools-sources">
        {/* The files are tabs beside the code: the arrow keys move through them and show each one. */}
        <Tabs orientation="vertical" value={current.path} onValueChange={(next) => { if (next) onPath(next) }}>
          <div data-slot="replay-devtools-files">
            <TabsList aria-label="Files">
              {evidence.files.map((f) => (
                <TabsTab key={f.path} value={f.path} title={f.path}>{sourceName(f.path)}</TabsTab>
              ))}
            </TabsList>
          </div>
          <TabsPanel value={current.path} ref={code} data-part="replay-devtools-code" style={{ '--replay-devtools-lineno': `${digits}ch` } as CSSProperties}>
            {rows.map((r, i) => {
              const lp = points.find((p) => p.line === r.line)
              const gap = i > 0 && r.line - rows[i - 1]!.line > 1
              return (
                <div key={r.line}>
                  {gap ? <div data-slot="replay-devtools-code-gap" aria-hidden="true">⋯</div> : null}
                  <div
                    data-slot="replay-devtools-code-line"
                    data-line={r.line}
                    data-focus={focus.has(r.line) || r.line === line || undefined}
                    data-paused={r.line === pausedLine || undefined}
                    data-breakpoint={lp ? '' : undefined}
                  >
                    <span data-part="hits">{r.hits ?? ''}</span>
                    <span data-part="lineno">{lp ? <i data-part="breakpoint" title={`Logpoint: ${lp.expression}`} /> : null}{r.line}</span>
                    <span data-part="text">{r.text ? (lexed?.has(r.line) ? highlight(r.text, lexed.get(r.line)!.spans, lexed.get(r.line)!.offset) : r.text) : ' '}</span>
                  </div>
                </div>
              )
            })}
          </TabsPanel>
        </Tabs>
        {watches.length ? (
          <section data-slot="replay-devtools-watch" aria-label="Watch">
            <h3 data-part="title">Watch</h3>
            <ul>
              {watches.map(({ lp, index, hit }) => (
                <li key={`${lp.path}:${lp.line}:${lp.expression}`} data-current={paused?.lp === lp || undefined}>
                  <button type="button" data-part="where" title={`${lp.path}:${lp.line}`} onClick={() => onPath(lp.path)}>
                    {sourceName(lp.path)}:{lp.line}
                    <span data-part="count">{index >= 0 ? `${index + 1}/${lp.hits.length}` : `0/${lp.hits.length}`}</span>
                  </button>
                  <code data-part="expr">{lp.expression}</code>
                  {hit ? (
                    <code key={index} data-part="value">{clip(hit.value, 400)}</code>
                  ) : (
                    <span data-part="pending">Not hit yet</span>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </TabsPanel>
  )
}

