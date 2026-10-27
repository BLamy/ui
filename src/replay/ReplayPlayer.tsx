/* The player behind `ReplayPreview`: an rrweb session replay in a browser frame. The headless `ReplayStage`
   plays the recording (rrweb loads lazily, on first render); this adds the chrome around it: a URL bar that
   follows the recording's navigations, play/pause, a scrubber with the recording's moments on a rail above
   it, a speed control, fullscreen, a drawn cursor whose clicks ripple, and DevTools: Console and Network buttons
   in the top bar with what had been logged and requested by the playhead, which open a DevTools panel over the page,
   and inspections (inspections.ts) that open it on a request or message as playback reaches them. A time window
   highlights a segment on the scrubber, opens there and plays just that, until you scrub outside it. Until the player is ready a
   poster (a page-shaped skeleton by default) holds the frame's exact size, so nothing jumps.

   Plain React + plain CSS (`@layer docstream.replay` in styles.css, `[data-slot]` hooks). Keys (focus inside
   the player): Space / K play and pause, ← → seek 5 s, J / L 10 s, < > speed, F fullscreen, Home / End jump
   to the ends. Everything drawn over the page is a function of the playhead, so scrubbing backwards replays
   the ripples and the URL too. */
import {
  memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type Ref,
} from 'react'
import { useReducedMotion } from 'framer-motion'
import { Lock, Maximize, Minimize, Pause, Play, RotateCcw } from 'lucide-react'
import { ReplayStage } from './ReplayStage'
import { DevtoolsButtons, DevtoolsPanel, type ReplayDevtoolsTab } from './ReplayDevtools'
import { getReplayDevtools, replayDevtoolsAt } from './devtools'
import { getReplayInspections, replayInspectionAt, resolveReplayInspections, type ReplayInspection } from './inspections'
import { mergeReplaySources } from './sources'
import { getReplayMarkers, getReplayMeta, getReplayPointerTrack, replayPointerAt } from './markers'
import type { ReplayMarker, ReplayMarkerKind, ReplayPointerTrack } from './markers'
import type { ReplayStageHandle } from './stage-types'
import type { ReplayEvent } from './types'

const TRAFFIC_LIGHTS = ['#FF5F57', '#FEBC2E', '#28C840'] as const
export const DEFAULT_PLAYER_SPEEDS = [1, 2, 4, 0.5]
const RIPPLE_MS = 650

export type ReplayChrome = 'browser' | 'minimal' | 'none'

export interface ReplayPreviewHandle {
  play(offset?: number): void
  pause(offset?: number): void
  /** Jump to `ms` from the start, keeping the play state. */
  seek(ms: number): void
  toggle(): void
  getCurrentTime(): number
  /** Jump to an inspection (by its id) and open DevTools on what it found. */
  inspect(id: string): void
}

/** Options shared by every `ReplayPreview` (an `events` player or a `source` embed). */
export interface ReplayPlayerOptions {
  /** Address shown in the URL bar (default: the recording's own URL, following its navigations). */
  url?: string
  /** Accessible name of the player (default "Session replay"). */
  title?: string
  /** `browser` (default): window buttons, URL bar, controls. `minimal`: the page and its controls in a rounded
   *  card. `none`: no frame, fill the parent (a hero, a lightbox). */
  chrome?: ReplayChrome
  /** macOS window buttons in the browser chrome (default true). */
  trafficLights?: boolean
  /** Play/pause, scrubber, speed and fullscreen (default true). */
  controls?: boolean
  autoplay?: boolean
  /** Restart at the end (with a `timeWindow`, at the window's end, from its start). */
  loop?: boolean
  /** Where the player starts, in ms from the start (default 0, or the `timeWindow`'s start). */
  initialTime?: number
  /** `[start, end]` in ms: the segment that matters. The player opens at `start` with the segment highlighted on the
   *  scrubber, and playing from inside it stops at `end` (play again to replay it). Scrub or seek outside it and
   *  playback runs on through the rest of the recording. */
  timeWindow?: readonly [number, number]
  /** Speeds the speed button cycles through; the first is the initial speed (default 1, 2, 4, 0.5). */
  speeds?: number[]
  /** Markers on a rail above the scrubber: off by default (a plain seek bar). `true` reads them from the
   *  recording (clicks, failed requests, console errors, navigations, checkpoints, inspections), or pass your
   *  own. Giving `markerKinds` turns the recorded ones on. */
  markers?: boolean | ReplayMarker[]
  /** Which recorded marker kinds to show (default all). */
  markerKinds?: ReplayMarkerKind[]
  /** Console and Network buttons (in the top bar, or beside the controls without the browser chrome) that open a
   *  DevTools panel cut at the playhead, shown when the recording has console messages, requests or inspections.
   *  `disableDevtools` removes them, the panel and the inspections. */
  disableDevtools?: boolean
  /** @deprecated Use `disableDevtools`. `false` is the same as `disableDevtools`. */
  devtools?: boolean
  /** Open the DevTools panel on this tab at mount. */
  defaultDevtoolsTab?: ReplayDevtoolsTab
  /** Moments where a request or console message was inspected. As playback reaches one, DevTools opens on its
   *  tab with that request or message selected and the label above it; playback doesn't stop. Added to the
   *  recording's own `inspect` custom events, and to the rail as checkpoints. */
  inspections?: ReplayInspection[]
  /** A HAR (object or JSON text) recorded alongside: its requests join the DevTools Network list, on their own
   *  timestamps (sources.ts). Its `log._inspections` join `inspections`. */
  har?: unknown
  /** A console log recorded alongside (`<ISO time> [level] message` lines): its messages join the Console. */
  consoleLog?: string
  /** A DevTools panel an inspection opened closes after this long (ms of playback) without a new request, console
   *  message or inspection (default 5000). `false` keeps it open. A panel you opened or touched never closes by
   *  itself. */
  autoCloseDevtools?: number | false
  /** Draw the recorded pointer and click ripples (default true). */
  cursor?: boolean
  /** `width` (default): the page scales to the frame's width and sets its height. `contain`: fill the frame's
   *  height (give it one) and letterbox the page. */
  fit?: 'width' | 'contain'
  /** Shown until the player is ready (default: a page-shaped skeleton). */
  poster?: ReactNode
  /** Mount the player only once the frame nears the viewport (default true). */
  lazy?: boolean
  /** Imperative control (play, pause, seek). */
  playerRef?: Ref<ReplayPreviewHandle | null>
  onTimeUpdate?: (ms: number) => void
  onPlayingChange?: (playing: boolean) => void
  onMarkerPress?: (marker: ReplayMarker) => void
  className?: string
  style?: CSSProperties
}

/** The latest of sorted `times` at or before `t`, or undefined. */
function latestAtOrBefore(times: readonly number[], t: number): number | undefined {
  let lo = 0
  let hi = times.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (times[mid]! <= t) lo = mid + 1
    else hi = mid
  }
  return lo ? times[lo - 1] : undefined
}

export function formatReplayTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const MARKER_NOUN: Record<ReplayMarkerKind, string> = {
  click: 'Click', error: 'Error', network: 'Request failed', navigation: 'Navigation', custom: 'Checkpoint',
}

export function ReplayPlayer({
  events: recordingEvents, har, consoleLog, url, title = 'Session replay', chrome = 'browser', trafficLights = true, controls = true,
  autoplay = false, loop = false, initialTime: initialTimeProp, timeWindow, speeds = DEFAULT_PLAYER_SPEEDS, markers, markerKinds,
  cursor = true, disableDevtools = false, devtools = true, defaultDevtoolsTab, inspections, autoCloseDevtools = 5000, fit = 'width', poster, lazy = true, playerRef, onTimeUpdate, onPlayingChange, onMarkerPress,
  className, style,
}: ReplayPlayerOptions & { events: ReplayEvent[] }) {
  // The recording plus whatever was recorded beside it (a HAR, a console log), as one event list for DevTools,
  // inspections and markers. The stage, the clock and the pointer read the recording alone, so a HAR or a log that
  // arrives while it plays only adds to DevTools: the page replay never restarts.
  const events = useMemo(() => mergeReplaySources(recordingEvents, { har, consoleLog }), [recordingEvents, har, consoleLog])
  const rootRef = useRef<HTMLDivElement>(null)
  const stage = useRef<ReplayStageHandle>(null)
  const reduced = useReducedMotion()
  const meta = useMemo(() => getReplayMeta(recordingEvents), [recordingEvents])
  const track = useMemo(() => getReplayPointerTrack(recordingEvents), [recordingEvents])
  const recorded = useMemo(() => getReplayMarkers(events), [events])

  const toolsOn = devtools && !disableDevtools
  const tools = useMemo(() => getReplayDevtools(events), [events])
  const resolved = useMemo(
    () => (toolsOn ? resolveReplayInspections([...getReplayInspections(events), ...(inspections ?? [])], tools) : []),
    [toolsOn, events, inspections, tools],
  )
  const showTools = toolsOn && (tools.console.length > 0 || tools.network.length > 0 || resolved.length > 0)
  const [panel, setPanel] = useState<ReplayDevtoolsTab | null>(defaultDevtoolsTab ?? null)
  // Whether an inspection (rather than a press) opened the panel: it then leaves focus where it was.
  const [autoOpened, setAutoOpened] = useState(false)

  const shown = useMemo(() => {
    // Inspections from the prop join the rail as checkpoints (the recording's own are already among `recorded`).
    const own: ReplayMarker[] = toolsOn ? (inspections ?? []).map((inspection, i) => ({
      id: `inspection-${i}`, kind: 'custom', time: Math.max(0, inspection.time), label: inspection.label ?? 'Inspected',
    })) : []
    const list = Array.isArray(markers) ? markers : markers ?? !!markerKinds ? [...recorded, ...own].sort((a, b) => a.time - b.time) : []
    return markerKinds ? list.filter((m) => markerKinds.includes(m.kind)) : list
  }, [markers, recorded, markerKinds, inspections, toolsOn])

  // The time window, clamped to the recording; dropped when it's empty.
  const span = useMemo(() => {
    if (!timeWindow) return null
    const start = Math.max(0, Math.min(timeWindow[0], meta.duration))
    const end = Math.max(start, Math.min(timeWindow[1], meta.duration))
    return end - start >= 1 ? { start, end } : null
  }, [timeWindow, meta.duration])
  const initialTime = initialTimeProp ?? span?.start ?? 0

  const [visible, setVisible] = useState(!lazy)
  const [ready, setReady] = useState(false)
  const [posterGone, setPosterGone] = useState(false)
  const [time, setTime] = useState(initialTime)
  const [playing, setPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
  // Stopped at the window's end: the center button replays the segment.
  const [windowDone, setWindowDone] = useState(false)
  const [speedIndex, setSpeedIndex] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)
  const duration = meta.duration
  const speedList = speeds.length ? speeds : DEFAULT_PLAYER_SPEEDS
  const speed = speedList[speedIndex % speedList.length] ?? 1

  // Lazy mount: start the player (and fetch rrweb) once the frame is near the viewport.
  useEffect(() => {
    if (visible) return
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return setVisible(true)
    const io = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), { rootMargin: '240px' })
    io.observe(el)
    return () => io.disconnect()
  }, [visible])

  useEffect(() => {
    const on = () => setFullscreen(document.fullscreenElement === rootRef.current)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  // The poster dissolves (CSS) once the page is ready, then leaves the tree.
  useEffect(() => {
    if (!ready) return setPosterGone(false)
    const timer = setTimeout(() => setPosterGone(true), reduced ? 120 : 260)
    return () => clearTimeout(timer)
  }, [ready, reduced])

  const resolvedRef = useRef(resolved)
  resolvedRef.current = resolved
  // The window, the playhead and the play state, for the handle (which never re-creates) and onTime.
  const spanRef = useRef(span)
  spanRef.current = span
  const timeRef = useRef(initialTime)
  const playingRef = useRef(false)
  // Whether playback is held to the window: it is when it starts (or is moved) inside it.
  const inWindow = (ms: number) => !!spanRef.current && ms >= spanRef.current.start && ms < spanRef.current.end
  const held = useRef(inWindow(initialTime))
  const handle = useMemo<ReplayPreviewHandle>(() => {
    const play = (offset?: number) => {
      const w = spanRef.current
      if (!w) { setFinished(false); return stage.current?.play(offset) }
      let from = offset ?? timeRef.current
      // Play at the window's end replays the window.
      if (w && offset === undefined && Math.abs(from - w.end) < 60) from = w.start
      held.current = inWindow(from)
      setFinished(false)
      setWindowDone(false)
      if (from !== timeRef.current) stage.current?.play(from)
      else stage.current?.play(offset)
    }
    const seek = (ms: number) => {
      held.current = inWindow(ms)
      setFinished(false)
      setWindowDone(false)
      stage.current?.seek(ms)
    }
    return {
      play,
      pause: (offset) => stage.current?.pause(offset),
      seek,
      toggle: () => {
        if (!spanRef.current) { setFinished(false); return stage.current?.toggle() }
        return playingRef.current ? stage.current?.pause() : play()
      },
      getCurrentTime: () => stage.current?.getCurrentTime() ?? 0,
      inspect: (id) => {
        const inspection = resolvedRef.current.find((x) => x.id === id)
        if (!inspection) return
        seek(inspection.time)
        setPanel(inspection.tab)
        setAutoOpened(false)
      },
    }
  }, [])
  useImperativeHandle(playerRef, () => handle, [handle])

  const onTime = useCallback((ms: number) => {
    timeRef.current = ms
    // Held to the window: stop at its end, or go round again with `loop`.
    const w = spanRef.current
    if (w && held.current && playingRef.current && ms >= w.end) {
      if (loop) stage.current?.seek(w.start)
      else {
        stage.current?.pause(w.end)
        setWindowDone(true)
        ms = w.end
        timeRef.current = ms
      }
    }
    setTime(ms)
    onTimeUpdate?.(ms)
  }, [onTimeUpdate, loop])
  const onPlaying = useCallback((p: boolean) => {
    playingRef.current = p
    setPlaying(p)
    if (p) setFinished(false)
    onPlayingChange?.(p)
  }, [onPlayingChange])

  const toggle = () => handle.toggle()
  const seekBy = (d: number) => handle.seek(Math.max(0, Math.min(duration, time + d)))
  const cycleSpeed = (d = 1) => setSpeedIndex((i) => (i + d + speedList.length) % speedList.length)
  const toggleFullscreen = () => {
    const el = rootRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
    else void el.requestFullscreen?.().catch(() => {})
  }
  const jumpTo = (m: ReplayMarker) => {
    handle.seek(Math.max(0, m.time - 250))
    onMarkerPress?.(m)
  }

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const target = e.target as HTMLElement
    if (e.metaKey || e.ctrlKey || e.altKey || target.closest('input:not([type=range]), textarea, [contenteditable=true]')) return
    const onSlider = target.matches('input[type=range]')
    const run = (fn: () => void) => { e.preventDefault(); fn() }
    switch (e.key) {
      case ' ': case 'k': case 'K': if (target.closest('button') && e.key === ' ') return; return run(toggle)
      case 'ArrowLeft': if (onSlider) return; return run(() => seekBy(-5000))
      case 'ArrowRight': if (onSlider) return; return run(() => seekBy(5000))
      case 'j': case 'J': return run(() => seekBy(-10000))
      case 'l': case 'L': return run(() => seekBy(10000))
      case 'Home': if (onSlider) return; return run(() => handle.seek(0))
      case 'End': if (onSlider) return; return run(() => handle.seek(duration))
      case '>': case '.': return run(() => cycleSpeed(1))
      case '<': case ',': return run(() => cycleSpeed(-1))
      case 'f': case 'F': return run(toggleFullscreen)
    }
  }

  // The URL bar follows the recording: the latest navigation at or before the playhead.
  const href = useMemo(() => {
    if (url) return url
    let current = meta.href ?? ''
    for (const m of recorded) if (m.kind === 'navigation' && m.time <= time && m.detail) current = m.detail
    return current
  }, [url, meta.href, recorded, time])

  const toolsState = useMemo(() => replayDevtoolsAt(tools, time), [tools, time])
  const openTools = (tab: ReplayDevtoolsTab) => { setAutoOpened(false); setPanel((p) => (p === tab ? null : tab)) }
  // Clicking, scrolling or typing in a panel an inspection opened makes it the user's: it won't close by itself.
  const claimPanel = () => setAutoOpened(false)

  // Inspect mode: the inspection at the playhead opens DevTools on what it found. Only a change of inspection does
  // (closing the panel keeps it closed until the next one). Seeking never closes it: going to another request,
  // before or after the inspection, leaves the panel where it is. A panel the user opened, or has touched, stays
  // theirs: an inspection switches its tab but never closes it.
  const inspection = showTools ? replayInspectionAt(resolved, time) : undefined
  const inspectionId = inspection?.id
  const inspectionTab = inspection?.tab
  const lastInspection = useRef<string | undefined>(undefined)
  const panelRef = useRef(panel)
  panelRef.current = panel
  useEffect(() => {
    if (inspectionId === lastInspection.current) return
    lastInspection.current = inspectionId
    if (!inspectionTab) return
    if (panelRef.current === null) setAutoOpened(true)
    setPanel(inspectionTab)
  }, [inspectionId, inspectionTab])

  // An auto-opened panel closes once playback has gone `autoCloseDevtools` ms (recording time) without a new
  // request, console message or inspection. Paused, it stays.
  const activity = useMemo(
    () => [...tools.network.map((r) => r.time), ...tools.console.map((m) => m.time), ...resolved.map((i) => i.time)].sort((a, b) => a - b),
    [tools, resolved],
  )
  const openedAt = useRef(0)
  useEffect(() => { if (autoOpened && panel) openedAt.current = time }, [autoOpened, panel])
  useEffect(() => {
    if (autoCloseDevtools === false || !autoOpened || !panel || !playing) return
    const last = Math.max(openedAt.current, latestAtOrBefore(activity, time) ?? -Infinity)
    if (time >= last && time - last >= autoCloseDevtools) setPanel(null)
  }, [time, playing, autoOpened, panel, activity, autoCloseDevtools])
  const toolButtons = showTools ? <DevtoolsButtons state={toolsState} open={panel} onOpen={openTools} /> : null

  const w = meta.width || 1280
  const h = meta.height || 800
  const contain = fit === 'contain' || fullscreen

  return (
    <div
      ref={rootRef}
      className={className ? `replay-preview ${className}` : 'replay-preview'}
      data-slot="replay-preview"
      data-replay-preview="rrweb"
      data-chrome={chrome}
      data-fit={contain ? 'contain' : 'width'}
      data-state={!ready ? 'loading' : playing ? 'playing' : 'paused'}
      data-fullscreen={fullscreen || undefined}
      role="group"
      aria-label={title}
      aria-busy={!ready || undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      // A click anywhere in the player (the page, the frame) makes its keys live, without a focus ring.
      onPointerDown={() => {
        const root = rootRef.current
        if (root && !root.contains(document.activeElement)) root.focus({ preventScroll: true })
      }}
      style={style}
    >
      {chrome === 'browser' ? <BrowserBar href={href} trafficLights={trafficLights} loading={!ready && meta.playable} actions={toolButtons} /> : null}

      <div data-slot="replay-preview-stage" style={{ '--replay-ar': `${w} / ${h}` } as CSSProperties}>
        {visible && meta.playable ? (
          <ReplayStage
            ref={stage}
            events={recordingEvents}
            fit="contain"
            speed={speed}
            loop={loop && !span}
            autoplay={autoplay}
            initialTime={initialTime}
            showMouse={false}
            className="replay-preview__page"
            overlay={cursor ? <PointerOverlay track={track} time={time} reduced={!!reduced} /> : null}
            onReady={() => setReady(true)}
            onTimeUpdate={onTime}
            onPlayingChange={onPlaying}
            onFinish={() => setFinished(true)}
          />
        ) : null}

        {!posterGone ? (
          <div data-slot="replay-preview-poster" data-leaving={ready || undefined}>
            {poster ?? <PagePoster empty={!meta.playable} />}
          </div>
        ) : null}

        {showTools && panel ? (
          <DevtoolsPanel
            state={toolsState}
            tab={panel}
            onTab={setPanel}
            onClose={() => { setPanel(null); rootRef.current?.focus({ preventScroll: true }) }}
            onSeek={(ms) => handle.seek(ms)}
            inspection={inspection}
            autoFocus={!autoOpened}
            onInteract={claimPanel}
          />
        ) : null}

        {controls ? (
          <div data-slot="replay-preview-center" data-show={(ready && !playing && !(showTools && panel)) || undefined}>
            <button
              type="button"
              tabIndex={-1}
              aria-label={finished ? 'Replay from the start' : windowDone ? 'Replay the segment' : 'Play'}
              // The overlay leaves as playback starts; keep focus (and the keys) in the player.
              onClick={() => { rootRef.current?.focus({ preventScroll: true }); toggle() }}
            >
              {finished || windowDone ? <RotateCcw size={22} strokeWidth={2.4} /> : <Play size={22} strokeWidth={2.4} fill="currentColor" />}
            </button>
          </div>
        ) : null}
      </div>

      {controls ? (
        <div data-slot="replay-preview-controls">
          <button type="button" data-slot="replay-preview-play" aria-label={playing ? 'Pause' : 'Play'} onClick={toggle} disabled={!ready}>
            {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          </button>
          <span data-slot="replay-preview-time">
            <span>{formatReplayTime(time)}</span> / {formatReplayTime(duration)}
          </span>
          <Scrubber
            time={time}
            duration={duration}
            span={span}
            markers={shown}
            disabled={!ready}
            onSeek={(ms) => handle.seek(ms)}
            onMarker={jumpTo}
          />
          {chrome !== 'browser' ? toolButtons : null}
          <button type="button" data-slot="replay-preview-speed" aria-label={`Playback speed ${speed}×`} onClick={() => cycleSpeed(1)}>
            {`${speed}×`}
          </button>
          <button type="button" data-slot="replay-preview-fullscreen" aria-label={fullscreen ? 'Exit full screen' : 'Full screen'} onClick={toggleFullscreen}>
            {fullscreen ? <Minimize size={15} /> : <Maximize size={15} />}
          </button>
        </div>
      ) : null}
    </div>
  )
}

/* ── parts ───────────────────────────────────────────────────────────────────────── */

/** Splits an address for the URL bar: the host, and the path + query + hash after it. */
export function splitReplayAddress(href: string): { host: string; path: string } {
  const shown = href.replace(/^https?:\/\//, '')
  const cut = shown.search(/[/?#]/)
  return cut < 0 ? { host: shown, path: '' } : { host: shown.slice(0, cut), path: shown.slice(cut) }
}

export function BrowserBar({ href, trafficLights, loading, actions }: { href: string; trafficLights: boolean; loading: boolean; actions?: ReactNode }) {
  const { host, path } = splitReplayAddress(href)
  // Once the recording is past the site root, where it is (path, query, hash) is what matters:
  // it leads and keeps its room, and the host dims and gives way first.
  const primary = path && path !== '/' ? 'path' : 'host'
  return (
    <div data-slot="replay-preview-bar">
      {trafficLights ? (
        <span aria-hidden="true" data-slot="replay-preview-lights">
          {TRAFFIC_LIGHTS.map((c) => <span key={c} style={{ '--light': c } as CSSProperties} />)}
        </span>
      ) : null}
      <div data-slot="replay-preview-address">
        <span data-slot="replay-preview-lock" aria-hidden="true">
          {loading ? <span data-slot="replay-preview-spinner" /> : <Lock size={10} strokeWidth={2.5} />}
        </span>
        <span data-slot="replay-preview-url" data-primary={primary} title={href}>
          <span data-part="host">{host}</span>
          {path ? <span data-part="path">{path}</span> : null}
        </span>
      </div>
      {actions ? <div data-slot="replay-preview-actions">{actions}</div>
        : trafficLights ? <span aria-hidden="true" data-slot="replay-preview-lights-spacer" /> : null}
    </div>
  )
}

/** The recorded pointer and its click ripples, in recorded-viewport coordinates. */
const PointerOverlay = memo(function PointerOverlay({ track, time, reduced }: { track: ReplayPointerTrack; time: number; reduced: boolean }) {
  const at = replayPointerAt(track, time)
  const ripples = track.clicks.filter((c) => time >= c.time && time - c.time < RIPPLE_MS)
  return (
    <div data-slot="replay-preview-pointer" aria-hidden="true">
      {ripples.map((c) => {
        const p = (time - c.time) / RIPPLE_MS
        const ease = 1 - (1 - p) ** 3
        return (
          <span
            key={c.time}
            data-slot="replay-preview-ripple"
            style={{
              left: c.x, top: c.y,
              transform: `translate(-50%, -50%) scale(calc(${reduced ? 0.8 : 0.25 + ease * 1.05} / var(--replay-scale, 1)))`,
              opacity: 1 - p,
            }}
          />
        )
      })}
      {at ? (
        <svg
          data-slot="replay-preview-cursor"
          viewBox="0 0 20 24" width="20" height="24"
          style={{ left: at.x - 2, top: at.y - 1, transform: 'scale(calc(1 / var(--replay-scale, 1)))' }}
        >
          <path d="M2.5 1.5v18.2l4.7-4.5 3 6.8 3.1-1.4-3-6.6h6.5z" fill="#000" stroke="#fff" strokeWidth="1.4" strokeLinejoin="round" />
        </svg>
      ) : null}
    </div>
  )
})

function Scrubber({ time, duration, span, markers, disabled, onSeek, onMarker }: {
  time: number; duration: number; span: { start: number; end: number } | null; markers: ReplayMarker[]; disabled: boolean
  onSeek: (ms: number) => void; onMarker: (m: ReplayMarker) => void
}) {
  const max = Math.max(1, duration)
  const value = Math.min(time, max)
  // Dots closer than ~1.5% of the timeline would sit on top of each other: step each one 10px right of the last.
  const nudges = useMemo(() => {
    const out = new Map<string, number>()
    let last: { time: number; n: number } | null = null
    for (const m of [...markers].sort((a, b) => a.time - b.time)) {
      if (m.kind === 'click') continue
      const n: number = last && m.time - last.time < max * 0.015 ? last.n + 1 : 0
      out.set(m.id, n)
      last = { time: m.time, n }
    }
    return out
  }, [markers, max])
  return (
    <div data-slot="replay-preview-scrubber" data-markers={markers.length ? '' : undefined}>
      {span ? (
        <div
          data-slot="replay-preview-window"
          aria-hidden="true"
          title={`${formatReplayTime(span.start)}–${formatReplayTime(span.end)}`}
          style={{ '--replay-window-start': span.start / max, '--replay-window-size': (span.end - span.start) / max } as CSSProperties}
        />
      ) : null}
      {markers.length ? (
        <div data-slot="replay-preview-markers">
          {markers.map((m) => (
            <button
              key={m.id}
              type="button"
              data-kind={m.kind}
              aria-label={`${m.label} at ${formatReplayTime(m.time)}`}
              title={`${formatReplayTime(m.time)} · ${MARKER_NOUN[m.kind]}\n${m.detail ? `${m.label} — ${m.detail}` : m.label}`}
              style={{ left: `calc(${(m.time / max) * 100}% + ${(nudges.get(m.id) ?? 0) * 10}px)` }}
              onClick={() => onMarker(m)}
              disabled={disabled}
            />
          ))}
        </div>
      ) : null}
      <input
        type="range"
        aria-label="Playback position"
        aria-valuetext={`${formatReplayTime(value)} of ${formatReplayTime(duration)}${span ? `, segment ${formatReplayTime(span.start)} to ${formatReplayTime(span.end)}` : ''}`}
        min={0}
        max={max}
        step={10}
        value={value}
        disabled={disabled}
        style={{
          '--replay-progress': `${(value / max) * 100}%`,
          ...(span ? { '--replay-progress-start': `${(span.start / max) * 100}%` } : {}),
        } as CSSProperties}
        onChange={(e) => onSeek(Number(e.currentTarget.value))}
      />
    </div>
  )
}

/** A page-shaped placeholder: header, hero lines and a card grid, sized to the frame. */
function PagePoster({ empty }: { empty: boolean }) {
  return (
    <div data-slot="replay-preview-skeleton">
      <div data-part="header">
        <i style={{ width: '12%' }} />
        <i style={{ width: '8%' }} />
        <i style={{ width: '8%' }} />
        <span />
        <i data-tone="block" style={{ width: '9%' }} />
      </div>
      <div data-part="hero">
        <i style={{ width: '38%', height: 12 }} />
        <i style={{ width: '24%', height: 8 }} />
      </div>
      <div data-part="grid">
        {[0, 1, 2, 3].map((i) => <i key={i} data-tone="block" />)}
      </div>
      {empty ? <span data-part="empty"><span>This recording has no page snapshot to play</span></span> : null}
    </div>
  )
}
