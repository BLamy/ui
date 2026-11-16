import { lazy, Suspense, useEffect, useId, useRef, useState, useSyncExternalStore, type CSSProperties, type Ref } from "react"
import type { ChangeDetails } from "@ui-sdk/core"
import { Code2, Loader2, Pause, Play, SlidersHorizontal, Undo2 } from "lucide-react"
import { HighlightedCode } from "../docs/HighlightedCode"
import type { StrudelRackChangeDetails } from "./rack-types"
import { Panel, PanelTrigger, usePanel } from "./panel"
import {
  DEFAULT_SAMPLES,
  getStrudelSnapshot,
  playStrudel,
  stopStrudel,
  strudelNow,
  subscribeStrudel,
  updateStrudel,
  type StrudelHap,
  type StrudelPattern,
} from "./engine"

// The rack parses the code (acorn + the mini-notation parser); it loads the first time someone opens it.
const StrudelRack = lazy(() => import("./StrudelRack"))

/** Why a panel (equipment or code) opened or closed: UI SDK's collapsible reasons. */
export type StrudelPanelChangeReason = "trigger-press" | "find-in-page" | "imperative"

/** What `onCodeChange` reports with the code: a rack edit (a knob, fader, mute, sound…) or the Revert button. */
export interface StrudelCodeChangeDetails {
  reason: "rack-edit" | "revert"
  /** The click, key or drag behind it, when there is one. */
  event?: Event
  /** For a rack edit: which control made it and how (the rack's own `onValueChange` details). */
  rack?: StrudelRackChangeDetails
}

export interface StrudelPlayerProps {
  /** Strudel pattern code (what you would type at strudel.cc). */
  code?: string
  /** URL of a `.strudel` file to load when `code` is absent. */
  src?: string
  /** The track name: the player's title and its buttons' names ("Play <title>"). Defaults to the file name. */
  title?: string
  /** Classes on the root `<figure>` (`.docstream-strudel`). */
  className?: string
  /** Inline styles on the root `<figure>`. */
  style?: CSSProperties
  /** The root `<figure>` element. */
  ref?: Ref<HTMLElement>
  /** The figure's accessible name. Defaults to `title`, then the file name, then "Strudel pattern". */
  "aria-label"?: string
  /** Sample banks to load before the first play. Defaults to the Tidal dirt-samples. */
  samples?: readonly string[]
  /** Offer the equipment rack (generated from the code) behind a toggle. `false` leaves the toggle out. Defaults to true. */
  rack?: boolean
  /** Whether the equipment panel is open. Pass it to control the panel; pair it with `onRackOpenChange`. */
  rackOpen?: boolean
  /** Whether the equipment panel is open at first, when uncontrolled. Defaults to false. */
  defaultRackOpen?: boolean
  /** Runs when the equipment panel wants to open or close. `details.reason` says why, `details.cancel()` stops it. */
  onRackOpenChange?: (open: boolean, details: ChangeDetails<StrudelPanelChangeReason>) => void
  /** Whether the code panel is open. Pass it to control the panel; pair it with `onCodeOpenChange`. */
  codeOpen?: boolean
  /** Whether the code panel is open at first, when uncontrolled. Defaults to false. */
  defaultCodeOpen?: boolean
  /** Runs when the code panel wants to open or close. `details.reason` says why, `details.cancel()` stops it. */
  onCodeOpenChange?: (open: boolean, details: ChangeDetails<StrudelPanelChangeReason>) => void
  /** @deprecated Use `defaultCodeOpen`. Still honored when `defaultCodeOpen` is not set. */
  showCode?: boolean
  /** @deprecated Use `defaultRackOpen`. Still honored when `defaultRackOpen` is not set. */
  showRack?: boolean
  /** Called with the code after every rack edit, and after Revert; `details.reason` says which. */
  onCodeChange?: (code: string, details: StrudelCodeChangeDetails) => void
}

/** Open state for one panel: controlled when `open` is given, else its own, starting at `defaultOpen`. */
function usePanelOpen(open: boolean | undefined, defaultOpen: boolean, onOpenChange: StrudelPlayerProps["onRackOpenChange"]) {
  const [own, setOwn] = useState(defaultOpen)
  const current = open ?? own
  const change = (next: boolean, details: ChangeDetails<StrudelPanelChangeReason>) => {
    onOpenChange?.(next, details)
    if (open === undefined && !details.canceled) setOwn(next)
  }
  return [current, change] as const
}

type Source = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; code: string }

const NOTE = /^([a-g])([#bs]*)(-?\d+)?$/i
const STEPS: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 }

// A vertical position for an event: its pitch when it has one, else a stable lane per sample name.
function pitch(value: unknown): number | null {
  if (typeof value === "number") return value
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (typeof v.note === "number") return v.note
  if (typeof v.note === "string") {
    const m = NOTE.exec(v.note)
    if (m) {
      const accidental = [...m[2]!].reduce((n, c) => n + (c === "b" ? -1 : 1), 0)
      return STEPS[m[1]!.toLowerCase()]! + accidental + (Number(m[3] ?? 3) + 1) * 12
    }
  }
  if (typeof v.freq === "number") return 69 + 12 * Math.log2(v.freq / 440)
  if (typeof v.n === "number" && typeof v.s !== "string") return v.n
  if (typeof v.s === "string") {
    let h = 0
    for (const c of v.s) h = (h * 31 + c.charCodeAt(0)) | 0
    return (Math.abs(h) % 24) + (typeof v.n === "number" ? v.n : 0)
  }
  return null
}

const num = (t: number | { valueOf(): number }) => Number(t.valueOf())

// Scrolling piano roll: two cycles centered on the playhead, onsets only. Idle: quiet bars.
function drawRoll(canvas: HTMLCanvasElement, pattern: StrudelPattern | null, now: number | null) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(canvas.clientWidth * dpr))
  const h = Math.max(1, Math.round(canvas.clientHeight * dpr))
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  ctx.clearRect(0, 0, w, h)
  ctx.fillStyle = getComputedStyle(canvas).color
  if (!pattern || now === null) {
    ctx.globalAlpha = 0.18
    const bars = 48
    for (let i = 0; i < bars; i++) {
      const bh = (0.2 + 0.6 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6))) * h
      ctx.fillRect((i / bars) * w + 1, (h - bh) / 2, w / bars - 3 * dpr, bh)
    }
    ctx.globalAlpha = 1
    return
  }
  const begin = now - 1, end = now + 1
  let haps: StrudelHap[]
  try {
    haps = pattern.queryArc(begin, end).filter((hap) => hap.whole && num(hap.whole.begin) === num(hap.part.begin))
  } catch {
    return
  }
  const pitches = haps.map((hap) => pitch(hap.value))
  const known = pitches.filter((p): p is number => p !== null)
  const lo = known.length ? Math.min(...known) : 0
  const hi = known.length ? Math.max(...known) : 1
  const range = Math.max(hi - lo, 11)
  const pad = 4 * dpr
  const lane = Math.max(3 * dpr, Math.min(10 * dpr, (h - 2 * pad) / (range + 1)))
  const x = (t: number) => ((t - begin) / (end - begin)) * w
  haps.forEach((hap, i) => {
    const p = pitches[i] ?? lo
    const s = num(hap.whole!.begin), e = num(hap.whole!.end)
    const y = h - pad - lane - ((p - lo + (range - (hi - lo)) / 2) / range) * (h - 2 * pad - lane)
    ctx.globalAlpha = s <= now && now < e ? 1 : s > now ? 0.45 : 0.25
    ctx.fillRect(x(s), y, Math.max(2 * dpr, x(e) - x(s) - 1.5 * dpr), lane)
  })
  ctx.globalAlpha = 0.6
  ctx.fillRect(w / 2 - dpr / 2, 0, dpr, h)
  ctx.globalAlpha = 1
}

/** A live-coded music player: Strudel (strudel.cc) runs the pattern in this page, no iframe. */
export function StrudelPlayer({
  code,
  src,
  title,
  className,
  style,
  ref,
  "aria-label": ariaLabel,
  samples = DEFAULT_SAMPLES,
  rack = true,
  rackOpen: rackOpenProp,
  defaultRackOpen,
  onRackOpenChange,
  codeOpen: codeOpenProp,
  defaultCodeOpen,
  onCodeOpenChange,
  showCode = false,
  showRack = false,
  onCodeChange,
}: StrudelPlayerProps) {
  const id = useId()
  const [source, setSource] = useState<Source>(() => (code !== undefined ? { kind: "ready", code } : { kind: "loading" }))
  const [codeOpen, setCodeOpen] = usePanelOpen(codeOpenProp, defaultCodeOpen ?? showCode, onCodeOpenChange)
  const [rackOpen, setRackOpen] = usePanelOpen(rackOpenProp, defaultRackOpen ?? showRack, onRackOpenChange)
  // The rack edits a working copy; `playable` is that copy with the rack's mutes and solos applied.
  const [edited, setEdited] = useState<string | null>(null)
  const [playable, setPlayable] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cycle, setCycle] = useState(0)
  const pattern = useRef<StrudelPattern | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const snapshot = useSyncExternalStore(subscribeStrudel, getStrudelSnapshot, getStrudelSnapshot)
  const status = snapshot.owner === id ? snapshot.status : "idle"

  useEffect(() => {
    if (code !== undefined) {
      setSource({ kind: "ready", code })
      return
    }
    if (!src) {
      setSource({ kind: "error", message: "no pattern" })
      return
    }
    let live = true
    setSource({ kind: "loading" })
    fetch(src)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`.trim())
        return res.text()
      })
      .then((text) => live && setSource({ kind: "ready", code: text }))
      .catch((err: unknown) => live && setSource({ kind: "error", message: err instanceof Error ? err.message : String(err) }))
    return () => {
      live = false
    }
  }, [code, src])

  // Stop our pattern when the player unmounts or its code changes underneath it.
  const ready = source.kind === "ready" ? source.code : null
  useEffect(() => {
    setEdited(null)
    setPlayable(null)
    return () => void stopStrudel(id)
  }, [id, ready])
  const current = edited ?? ready
  const toPlay = playable ?? current

  // Live edits: while playing, swap in the new pattern without stopping.
  useEffect(() => {
    if (status !== "playing" || !toPlay) return
    const timer = setTimeout(() => {
      updateStrudel(id, toPlay).then(
        (p) => {
          if (p) pattern.current = p
          setError(null)
        },
        (err: unknown) => setError(err instanceof Error ? err.message : String(err)),
      )
    }, 120)
    return () => clearTimeout(timer)
  }, [toPlay])

  const edit = (next: string, reason: StrudelCodeChangeDetails["reason"], extra: Omit<StrudelCodeChangeDetails, "reason"> = {}) => {
    setEdited(next)
    onCodeChange?.(next, { reason, ...extra })
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (status !== "playing") {
      drawRoll(canvas, null, null)
      const resize = new ResizeObserver(() => drawRoll(canvas, null, null))
      resize.observe(canvas)
      return () => resize.disconnect()
    }
    let frame = 0
    let shown = -1
    const tick = () => {
      const now = strudelNow()
      drawRoll(canvas, pattern.current, now)
      const whole = now === null ? 0 : Math.floor(now) + 1
      if (whole !== shown) setCycle((shown = whole))
      frame = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(frame)
  }, [status])

  const toggle = async () => {
    if (!toPlay) return
    if (status !== "idle") {
      await stopStrudel(id)
      return
    }
    setError(null)
    try {
      pattern.current = await playStrudel(id, toPlay, samples)
    } catch (err) {
      if (err instanceof Error && err.message === "superseded") return
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const label = title ?? (src ? src.split(/[?#]/)[0]!.split("/").pop()! : "Strudel pattern")
  const rackPanel = usePanel({ open: rackOpen, onOpenChange: setRackOpen })
  const codePanel = usePanel({ open: codeOpen, onOpenChange: setCodeOpen })
  const sub =
    source.kind === "error"
      ? `Couldn't load: ${source.message}`
      : source.kind === "loading"
        ? "Loading…"
        : status === "loading"
          ? "Loading sounds…"
          : status === "playing"
            ? `Cycle ${cycle}`
            : "Strudel"
  return (
    <figure ref={ref} className={`docstream-strudel ${className ?? ""}`.trim()} style={style} aria-label={ariaLabel ?? label} data-state={status}>
      <div className="docstream-strudel__bar">
        {/* A press while the sounds load stops it, so this stays a plain button rather than one that waits. */}
        <button
          type="button"
          className="docstream-strudel__play"
          onClick={toggle}
          disabled={source.kind !== "ready"}
          aria-label={status === "idle" ? `Play ${label}` : `Stop ${label}`}
        >
          {status === "loading" ? (
            <Loader2 className="docstream-strudel__spin" size={18} />
          ) : status === "playing" ? (
            <Pause size={18} />
          ) : (
            <Play size={18} />
          )}
        </button>
        <div className="docstream-strudel__meta">
          <span className="docstream-strudel__title">{label}</span>
          <span className="docstream-strudel__sub" aria-live="polite">
            {sub}
          </span>
        </div>
        <canvas ref={canvasRef} className="docstream-strudel__roll" aria-hidden="true" />
        {source.kind === "ready" && rack && (
          <PanelTrigger panel={rackPanel} className="docstream-strudel__toggle" aria-label="Equipment" title={rackOpen ? "Hide equipment" : "Show equipment"}>
            <SlidersHorizontal size={16} />
          </PanelTrigger>
        )}
        {source.kind === "ready" && (
          <PanelTrigger panel={codePanel} className="docstream-strudel__toggle" aria-label="Code" title={codeOpen ? "Hide code" : "Show code"}>
            <Code2 size={16} />
          </PanelTrigger>
        )}
      </div>
      {error && (
        <div className="docstream-strudel__error" role="alert">
          {error}
        </div>
      )}
      {current !== null && rack && (
        <Panel panel={rackPanel} className="docstream-strudel__equipment">
          <Suspense fallback={<div className="docstream-strudel__sub">Loading equipment…</div>}>
            {edited !== null && edited !== ready && (
              <button type="button" className="docstream-strudel__revert" onClick={(event) => edit(ready!, "revert", { event: event.nativeEvent })}>
                <Undo2 size={13} aria-hidden="true" /> Revert edits
              </button>
            )}
            <StrudelRack value={current} onValueChange={(next, rack) => edit(next, "rack-edit", { rack, ...(rack.event ? { event: rack.event } : {}) })} onPlayableChange={setPlayable} />
          </Suspense>
        </Panel>
      )}
      {current !== null && (
        <Panel panel={codePanel} className="docstream-strudel__code" tabIndex={0} role="region" aria-label={`${label} code`}>
          <HighlightedCode code={current.trim()} language="javascript" />
        </Panel>
      )}
    </figure>
  )
}
