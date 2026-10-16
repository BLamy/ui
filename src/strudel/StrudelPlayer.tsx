import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react"
import { Code2, Loader2, Pause, Play } from "lucide-react"
import { HighlightedCode } from "../docs/HighlightedCode"
import {
  DEFAULT_SAMPLES,
  getStrudelSnapshot,
  playStrudel,
  stopStrudel,
  strudelNow,
  subscribeStrudel,
  type StrudelHap,
  type StrudelPattern,
} from "./engine"

export interface StrudelPlayerProps {
  /** Strudel pattern code (what you would type at strudel.cc). */
  code?: string
  /** URL of a `.strudel` file to load when `code` is absent. */
  src?: string
  title?: string
  className?: string
  /** Show the code under the player from the start. Defaults to false. */
  showCode?: boolean
  /** Sample banks to load before the first play. Defaults to the Tidal dirt-samples. */
  samples?: readonly string[]
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
export function StrudelPlayer({ code, src, title, className, showCode = false, samples = DEFAULT_SAMPLES }: StrudelPlayerProps) {
  const id = useId()
  const [source, setSource] = useState<Source>(() => (code !== undefined ? { kind: "ready", code } : { kind: "loading" }))
  const [codeOpen, setCodeOpen] = useState(showCode)
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
  useEffect(() => () => void stopStrudel(id), [id, ready])

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
    if (source.kind !== "ready") return
    if (status !== "idle") {
      await stopStrudel(id)
      return
    }
    setError(null)
    try {
      pattern.current = await playStrudel(id, source.code, samples)
    } catch (err) {
      if (err instanceof Error && err.message === "superseded") return
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const label = title ?? (src ? src.split(/[?#]/)[0]!.split("/").pop()! : "Strudel pattern")
  const codeId = `${id}-code`
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
    <figure className={`docstream-strudel ${className ?? ""}`.trim()} data-state={status}>
      <div className="docstream-strudel__bar">
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
        {source.kind === "ready" && (
          <button
            type="button"
            className="docstream-strudel__toggle"
            aria-expanded={codeOpen}
            aria-controls={codeId}
            aria-label={codeOpen ? "Hide code" : "Show code"}
            onClick={() => setCodeOpen((open) => !open)}
          >
            <Code2 size={16} />
          </button>
        )}
      </div>
      {error && (
        <div className="docstream-strudel__error" role="alert">
          {error}
        </div>
      )}
      {source.kind === "ready" && codeOpen && (
        <div id={codeId} className="docstream-strudel__code">
          <HighlightedCode code={source.code.trim()} language="javascript" />
        </div>
      )}
    </figure>
  )
}
