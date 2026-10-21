/* The player's DevTools: a Console and a Network button in the top bar, with what had happened by the playhead —
   requests sent and, in red, how many had failed; console errors in red — and, behind them, a panel over the
   page in the manner of Chrome's DevTools. The Console lists what had been logged, warnings and errors on their
   tinted rows with their stack traces; the Network tab lists the requests that had been sent (a request still
   waiting at the playhead shows as pending), and a request's row opens its headers, payload and response.

   Everything is a function of the playhead: scrub back and the lists shrink to what DevTools showed then. A row's
   time jumps the player there. Esc closes the panel. Plain React + plain CSS, like the player. */
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { ChevronRight, CircleX, Info, Network, SquareTerminal, TriangleAlert, X } from 'lucide-react'
import type { ReplayConsoleEntry, ReplayDevtoolsState, ReplayRequest } from './devtools'

export type ReplayDevtoolsTab = 'console' | 'network'

const time = (ms: number) => {
  const s = Math.max(0, ms) / 1000
  return `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`
}
const duration = (ms?: number) => (ms === undefined ? '—' : ms < 1000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(2)} s`)

/** The two buttons for the top bar (or the controls row): icon, request count and, in red, what failed. */
export function DevtoolsButtons({ state, open, onOpen }: {
  state: ReplayDevtoolsState; open: ReplayDevtoolsTab | null; onOpen: (tab: ReplayDevtoolsTab) => void
}) {
  const { requests, failed, errors, warnings } = state.counts
  return (
    <div data-slot="replay-devtools-buttons">
      <button
        type="button"
        data-slot="replay-devtools-button"
        data-tab="console"
        aria-pressed={open === 'console'}
        aria-label={`Console: ${errors} ${errors === 1 ? 'error' : 'errors'}, ${warnings} ${warnings === 1 ? 'warning' : 'warnings'}`}
        title="Console"
        onClick={() => onOpen('console')}
      >
        <SquareTerminal size={14} strokeWidth={2} />
        {errors ? <span data-part="failed">{errors}</span> : null}
        {warnings ? <span data-part="warn">{warnings}</span> : null}
      </button>
      <button
        type="button"
        data-slot="replay-devtools-button"
        data-tab="network"
        aria-pressed={open === 'network'}
        aria-label={`Network: ${requests} ${requests === 1 ? 'request' : 'requests'}, ${failed} failed`}
        title="Network"
        onClick={() => onOpen('network')}
      >
        <Network size={14} strokeWidth={2} />
        <span data-part="count">{requests}</span>
        {failed ? <span data-part="failed">{failed}</span> : null}
      </button>
    </div>
  )
}

/** The panel over the page: Console and Network, cut at the playhead. */
export function DevtoolsPanel({ state, at, tab, onTab, onClose, onSeek }: {
  state: ReplayDevtoolsState; at: number; tab: ReplayDevtoolsTab; onTab: (tab: ReplayDevtoolsTab) => void
  onClose: () => void; onSeek: (ms: number) => void
}) {
  const panel = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(58)
  useEffect(() => { panel.current?.focus({ preventScroll: true }) }, [])

  // Drag the top edge to resize, as a fraction of the stage.
  const resize = (e: ReactPointerEvent<HTMLDivElement>) => {
    const stage = panel.current?.parentElement
    if (!stage) return
    e.preventDefault()
    const el = e.currentTarget
    el.setPointerCapture(e.pointerId)
    const box = stage.getBoundingClientRect()
    const move = (ev: PointerEvent) => setHeight(Math.min(92, Math.max(22, ((box.bottom - ev.clientY) / box.height) * 100)))
    const up = () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up) }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerup', up)
  }

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose() }
    // The player's own keys (space, arrows, J/K/L) stay out of the panel.
    else if (!(e.target as HTMLElement).closest('input')) e.stopPropagation()
  }

  const tabs: { id: ReplayDevtoolsTab; label: string }[] = [{ id: 'console', label: 'Console' }, { id: 'network', label: 'Network' }]
  return (
    <div
      ref={panel}
      data-slot="replay-devtools"
      role="dialog"
      aria-label="DevTools"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={{ height: `${height}%` }}
    >
      <div data-slot="replay-devtools-resize" aria-hidden="true" onPointerDown={resize} />
      <div data-slot="replay-devtools-tabs">
        <div data-slot="replay-devtools-tablist" role="tablist" aria-label="DevTools panels">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => onTab(t.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); onTab(t.id === 'console' ? 'network' : 'console') }
            }}
            tabIndex={tab === t.id ? 0 : -1}
          >
            {t.label}
            {t.id === 'console' && state.counts.errors ? <span data-part="failed">{state.counts.errors}</span> : null}
            {t.id === 'network' && state.counts.failed ? <span data-part="failed">{state.counts.failed}</span> : null}
          </button>
        ))}
        </div>
        <span data-part="at">As of {time(at)}</span>
        <button type="button" data-slot="replay-devtools-close" aria-label="Close DevTools" onClick={onClose}><X size={14} /></button>
      </div>
      {tab === 'console' ? <ConsolePane state={state} onSeek={onSeek} /> : <NetworkPane state={state} onSeek={onSeek} />}
    </div>
  )
}

/* ── Console ─────────────────────────────────────────────────────────────────────── */

type LevelFilter = 'all' | 'error' | 'warn' | 'info'
const LEVEL_ICON = { error: CircleX, warn: TriangleAlert, info: Info } as const

function ConsolePane({ state, onSeek }: { state: ReplayDevtoolsState; onSeek: (ms: number) => void }) {
  const [query, setQuery] = useState('')
  const [level, setLevel] = useState<LevelFilter>('all')
  const list = useRef<HTMLDivElement>(null)
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.console.filter((e) =>
      (level === 'all' || (level === 'info' ? e.level === 'info' || e.level === 'log' || e.level === 'debug' : e.level === level)) &&
      (!q || e.message.toLowerCase().includes(q)))
  }, [state.console, query, level])
  // Follow new messages as they're logged, unless you've scrolled up to read.
  const pinned = useRef(true)
  useEffect(() => {
    const el = list.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [rows.length])
  return (
    <div data-slot="replay-devtools-pane" data-pane="console">
      <div data-slot="replay-devtools-toolbar">
        <input type="search" aria-label="Filter console" placeholder="Filter" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        <select aria-label="Log levels" value={level} onChange={(e) => setLevel(e.currentTarget.value as LevelFilter)}>
          <option value="all">All levels</option>
          <option value="error">Errors</option>
          <option value="warn">Warnings</option>
          <option value="info">Info</option>
        </select>
        <span data-part="summary">
          {state.counts.errors ? <span data-part="failed">{state.counts.errors} {state.counts.errors === 1 ? 'error' : 'errors'}</span> : null}
          {state.counts.warnings ? <span data-part="warn">{state.counts.warnings} {state.counts.warnings === 1 ? 'warning' : 'warnings'}</span> : null}
        </span>
      </div>
      <div
        ref={list}
        data-slot="replay-devtools-list"
        role="log"
        aria-label="Console messages"
        onScroll={(e) => { const el = e.currentTarget; pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 8 }}
      >
        {rows.map((entry) => <ConsoleRow key={entry.id} entry={entry} onSeek={onSeek} />)}
        {!rows.length ? <p data-slot="replay-devtools-empty">{state.console.length ? 'No messages match the filter' : 'Nothing logged yet'}</p> : null}
        {state.counts.laterMessages ? <p data-slot="replay-devtools-later">{state.counts.laterMessages} more later in the recording</p> : null}
      </div>
    </div>
  )
}

function ConsoleRow({ entry, onSeek }: { entry: ReplayConsoleEntry; onSeek: (ms: number) => void }) {
  const Glyph = entry.level === 'error' || entry.level === 'warn' || entry.level === 'info' ? LEVEL_ICON[entry.level] : null
  const body = (
    <>
      <span data-part="icon" aria-hidden="true">{Glyph ? <Glyph size={12} strokeWidth={2.2} /> : null}</span>
      <span data-part="message">{entry.message || ' '}</span>
    </>
  )
  return (
    <div data-slot="replay-devtools-message" data-level={entry.level}>
      {entry.trace?.length ? (
        <details>
          <summary>{body}</summary>
          <ol data-part="trace">{entry.trace.map((frame, i) => <li key={i}>{frame}</li>)}</ol>
        </details>
      ) : <div data-part="line">{body}</div>}
      <button type="button" data-part="time" aria-label={`Go to ${time(entry.time)}`} onClick={() => onSeek(entry.time)}>{time(entry.time)}</button>
    </div>
  )
}

/* ── Network ─────────────────────────────────────────────────────────────────────── */

type RequestFilter = 'all' | 'fetch' | 'failed'
type Row = ReplayRequest & { pending: boolean }

const statusText = (r: Row) => (r.pending ? '(pending)' : r.status === undefined ? (r.failed ? '(failed)' : '—') : r.status === 0 ? '(failed)' : String(r.status))

function NetworkPane({ state, onSeek }: { state: ReplayDevtoolsState; onSeek: (ms: number) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<RequestFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
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
    <div data-slot="replay-devtools-pane" data-pane="network" data-detail={selected ? '' : undefined}>
      <div data-slot="replay-devtools-toolbar">
        <input type="search" aria-label="Filter requests" placeholder="Filter" value={query} onChange={(e) => setQuery(e.currentTarget.value)} />
        <div data-slot="replay-devtools-chips" role="radiogroup" aria-label="Request types">
          {(['all', 'fetch', 'failed'] as const).map((f) => (
            <button key={f} type="button" role="radio" aria-checked={filter === f} onClick={() => setFilter(f)}>
              {f === 'all' ? 'All' : f === 'fetch' ? 'Fetch/XHR' : 'Failed'}
            </button>
          ))}
        </div>
      </div>
      <div data-slot="replay-devtools-network">
        <div data-slot="replay-devtools-table-wrap">
          <table data-slot="replay-devtools-table">
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Status</th>
                {selected ? null : <><th scope="col">Method</th><th scope="col">Type</th><th scope="col">Time</th><th scope="col" data-col="waterfall">Waterfall</th></>}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  data-failed={(r.failed && !r.pending) || undefined}
                  data-pending={r.pending || undefined}
                  aria-selected={r.id === selectedId}
                  tabIndex={0}
                  onClick={() => setSelectedId(r.id === selectedId ? null : r.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(r.id === selectedId ? null : r.id) } }}
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
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length ? <p data-slot="replay-devtools-empty">{state.network.length ? 'No requests match the filter' : 'No requests yet'}</p> : null}
        </div>
        {selected ? <RequestDetail request={selected} onClose={() => setSelectedId(null)} onSeek={onSeek} /> : null}
      </div>
      <div data-slot="replay-devtools-status">
        <span>{state.counts.requests} {state.counts.requests === 1 ? 'request' : 'requests'}</span>
        {state.counts.failed ? <span data-part="failed">{state.counts.failed} failed</span> : null}
        {state.counts.laterRequests ? <span>{state.counts.laterRequests} more later in the recording</span> : null}
      </div>
    </div>
  )
}

type DetailTab = 'headers' | 'payload' | 'response'

function RequestDetail({ request, onClose, onSeek }: { request: Row; onClose: () => void; onSeek: (ms: number) => void }) {
  const [tab, setTab] = useState<DetailTab>('headers')
  const pretty = (body?: string) => {
    if (body === undefined || body === '') return undefined
    try { return JSON.stringify(JSON.parse(body), null, 2) } catch { return body }
  }
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
      <div data-slot="replay-devtools-detail-tabs">
        <button type="button" aria-label="Close request details" data-slot="replay-devtools-close" onClick={onClose}><X size={13} /></button>
        <div data-slot="replay-devtools-tablist" role="tablist" aria-label={`${request.name} details`}>
          {(['headers', 'payload', 'response'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t[0]!.toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>
      <div data-slot="replay-devtools-detail-body">
        {tab === 'headers' ? (
          <>
            <Section title="General" rows={general} />
            {request.responseHeaders ? <Section title="Response Headers" rows={Object.entries(request.responseHeaders)} /> : null}
            {request.requestHeaders ? <Section title="Request Headers" rows={Object.entries(request.requestHeaders)} /> : null}
            <button type="button" data-slot="replay-devtools-jump" onClick={() => onSeek(request.time)}>Go to {time(request.time)} in the recording</button>
          </>
        ) : (
          <Body text={pretty(tab === 'payload' ? request.requestBody : request.responseBody)} empty={tab === 'payload' ? 'This request has no recorded payload' : request.pending ? 'Waiting for the response' : 'The recording has no response body for this request'} />
        )}
      </div>
    </div>
  )
}

function Section({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <details open data-slot="replay-devtools-section">
      <summary><ChevronRight size={12} data-part="chevron" />{title}</summary>
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}
      </dl>
    </details>
  )
}

function Body({ text, empty }: { text?: string; empty: string }) {
  return text !== undefined ? <pre data-slot="replay-devtools-body">{text}</pre> : <p data-slot="replay-devtools-empty">{empty}</p>
}
