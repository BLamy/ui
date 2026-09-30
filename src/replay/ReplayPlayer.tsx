/* The player behind `ReplayPreview`: an rrweb session replay in a browser frame. The headless `ReplayStage`
   plays the recording (rrweb loads lazily, on first render); this adds the chrome around it: a URL bar that
   follows the recording's navigations, play/pause, a scrubber with the recording's moments on a rail above
   it, a speed control, fullscreen, and a drawn cursor whose clicks ripple. Until the player is ready a
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
  loop?: boolean
  /** Where the player starts, in ms from the start. */
  initialTime?: number
  /** Speeds the speed button cycles through; the first is the initial speed (default 1, 2, 4, 0.5). */
  speeds?: number[]
  /** Markers on the scrubber rail: `true` (default) reads them from the recording, `false` hides the rail,
   *  or pass your own. */
  markers?: boolean | ReplayMarker[]
  /** Which recorded marker kinds to show (default all). */
  markerKinds?: ReplayMarkerKind[]
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

export function formatReplayTime(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const MARKER_NOUN: Record<ReplayMarkerKind, string> = {
  click: 'Click', error: 'Error', network: 'Request failed', navigation: 'Navigation', custom: 'Checkpoint',
}

export function ReplayPlayer({
  events, url, title = 'Session replay', chrome = 'browser', trafficLights = true, controls = true,
  autoplay = false, loop = false, initialTime = 0, speeds = DEFAULT_PLAYER_SPEEDS, markers = true, markerKinds,
  cursor = true, fit = 'width', poster, lazy = true, playerRef, onTimeUpdate, onPlayingChange, onMarkerPress,
  className, style,
}: ReplayPlayerOptions & { events: ReplayEvent[] }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const stage = useRef<ReplayStageHandle>(null)
  const reduced = useReducedMotion()
  const meta = useMemo(() => getReplayMeta(events), [events])
  const track = useMemo(() => getReplayPointerTrack(events), [events])
  const recorded = useMemo(() => getReplayMarkers(events), [events])
  const shown = useMemo(() => {
    const list = Array.isArray(markers) ? markers : markers ? recorded : []
    return markerKinds ? list.filter((m) => markerKinds.includes(m.kind)) : list
  }, [markers, recorded, markerKinds])

  const [visible, setVisible] = useState(!lazy)
  const [ready, setReady] = useState(false)
  const [posterGone, setPosterGone] = useState(false)
  const [time, setTime] = useState(initialTime)
  const [playing, setPlaying] = useState(false)
  const [finished, setFinished] = useState(false)
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

  const handle = useMemo<ReplayPreviewHandle>(() => ({
    play: (offset) => { setFinished(false); stage.current?.play(offset) },
    pause: (offset) => stage.current?.pause(offset),
    seek: (ms) => { setFinished(false); stage.current?.seek(ms) },
    toggle: () => { setFinished(false); stage.current?.toggle() },
    getCurrentTime: () => stage.current?.getCurrentTime() ?? 0,
  }), [])
  useImperativeHandle(playerRef, () => handle, [handle])

  const onTime = useCallback((ms: number) => { setTime(ms); onTimeUpdate?.(ms) }, [onTimeUpdate])
  const onPlaying = useCallback((p: boolean) => {
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
      {chrome === 'browser' ? <BrowserBar href={href} trafficLights={trafficLights} loading={!ready && meta.playable} /> : null}

      <div data-slot="replay-preview-stage" style={{ '--replay-ar': `${w} / ${h}` } as CSSProperties}>
        {visible && meta.playable ? (
          <ReplayStage
            ref={stage}
            events={events}
            fit="contain"
            speed={speed}
            loop={loop}
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

        {controls ? (
          <div data-slot="replay-preview-center" data-show={(ready && !playing) || undefined}>
            <button
              type="button"
              tabIndex={-1}
              aria-label={finished ? 'Replay from the start' : 'Play'}
              // The overlay leaves as playback starts; keep focus (and the keys) in the player.
              onClick={() => { rootRef.current?.focus({ preventScroll: true }); toggle() }}
            >
              {finished ? <RotateCcw size={22} strokeWidth={2.4} /> : <Play size={22} strokeWidth={2.4} fill="currentColor" />}
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
            markers={shown}
            disabled={!ready}
            onSeek={(ms) => handle.seek(ms)}
            onMarker={jumpTo}
          />
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

export function BrowserBar({ href, trafficLights, loading }: { href: string; trafficLights: boolean; loading: boolean }) {
  const shown = href.replace(/^https?:\/\//, '')
  const slash = shown.indexOf('/')
  const host = slash < 0 ? shown : shown.slice(0, slash)
  const path = slash < 0 ? '' : shown.slice(slash)
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
        <span data-slot="replay-preview-url" title={href}>
          <span>{host}</span>
          <span>{path}</span>
        </span>
      </div>
      {trafficLights ? <span aria-hidden="true" data-slot="replay-preview-lights-spacer" /> : null}
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

function Scrubber({ time, duration, markers, disabled, onSeek, onMarker }: {
  time: number; duration: number; markers: ReplayMarker[]; disabled: boolean
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
        aria-valuetext={`${formatReplayTime(value)} of ${formatReplayTime(duration)}`}
        min={0}
        max={max}
        step={10}
        value={value}
        disabled={disabled}
        style={{ '--replay-progress': `${(value / max) * 100}%` } as CSSProperties}
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
