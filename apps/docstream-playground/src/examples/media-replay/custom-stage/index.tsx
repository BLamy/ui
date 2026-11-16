import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react"
import {
  ReplayPreview,
  type ReplayCustomStage,
  type ReplayCustomStageProps,
  type ReplayDevtools,
  type ReplayStageHandle,
} from "@brett_lamy/ui/docstream/replay"

const DURATION = 12_000
const FRAME_MS = 2_000
const COLORS = ["#2563eb", "#7c3aed", "#db2777", "#ea580c", "#16a34a", "#0891b2"]

// Pictures of a page rather than the page: all the player asks of a stage is the handle and to be told the time.
const FramesStage = forwardRef<ReplayStageHandle, ReplayCustomStageProps>(function FramesStage(
  { className, overlay, speed = 1, onReady, onTimeUpdate, onPlayingChange, onFinish },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const time = useRef(0)
  const playing = useRef(false)
  const raf = useRef(0)
  const rate = useRef(speed)
  rate.current = speed
  const told = useRef({ onTimeUpdate, onPlayingChange, onFinish })
  told.current = { onTimeUpdate, onPlayingChange, onFinish }

  const draw = useCallback(() => {
    const ctx = canvas.current?.getContext("2d")
    if (!ctx) return
    const frame = Math.min(COLORS.length - 1, Math.floor(time.current / FRAME_MS))
    ctx.fillStyle = COLORS[frame]!
    ctx.fillRect(0, 0, 1280, 800)
    ctx.fillStyle = "#fff"
    ctx.font = "600 96px system-ui"
    ctx.textAlign = "center"
    ctx.fillText(`Frame ${frame + 1}`, 640, 430)
  }, [])

  const moveTo = useCallback((ms: number) => {
    time.current = Math.max(0, Math.min(DURATION, ms))
    draw()
    told.current.onTimeUpdate?.(time.current)
  }, [draw])

  const setPlaying = useCallback((next: boolean) => {
    if (playing.current === next) return
    playing.current = next
    told.current.onPlayingChange?.(next)
    cancelAnimationFrame(raf.current)
    if (!next) return
    let last = performance.now()
    const tick = (now: number) => {
      moveTo(time.current + (now - last) * rate.current)
      last = now
      if (time.current >= DURATION) {
        setPlaying(false)
        told.current.onFinish?.()
      } else raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }, [moveTo])

  useImperativeHandle(ref, () => ({
    // Optional here too: toggle calls it with nothing, and TypeScript 6 takes this method's own arity for `this`.
    play(offset?: number) {
      moveTo(offset ?? (time.current >= DURATION ? 0 : time.current))
      setPlaying(true)
    },
    pause(offset) {
      setPlaying(false)
      if (offset !== undefined) moveTo(offset)
    },
    seek: moveTo,
    toggle() {
      if (playing.current) setPlaying(false)
      else this.play()
    },
    getCurrentTime: () => time.current,
    getDuration: () => DURATION,
    isPlaying: () => playing.current,
  }), [moveTo, setPlaying])

  useEffect(() => {
    moveTo(0)
    onReady?.({ duration: DURATION, width: 1280, height: 800 })
    return () => cancelAnimationFrame(raf.current)
    // Once, when the stage is up.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className={className} style={{ position: "relative", overflow: "hidden" }}>
      <canvas ref={canvas} width={1280} height={800} style={{ display: "block", width: "100%", height: "100%", objectFit: "contain" }} />
      {overlay}
    </div>
  )
})

const stage: ReplayCustomStage = { component: FramesStage, duration: DURATION, width: 1280, height: 800, href: "https://shop.example/cart" }

// Times are ms from the start, and each list is in time order.
const devtools: ReplayDevtools = {
  console: [
    { id: "m1", time: 500, level: "log", message: "Cart opened", args: ["Cart opened"], source: "console" },
    { id: "m2", time: 7_200, level: "warn", message: "The promo call was slow", args: ["The promo call was slow"], source: "console" },
    { id: "m3", time: 9_400, level: "error", message: "TypeError: order is undefined", args: ["TypeError: order is undefined"], source: "console" },
  ],
  network: [
    { id: "r1", time: 300, duration: 120, method: "GET", url: "/cart", name: "cart", status: 200, type: "document", failed: false },
    { id: "r2", time: 6_800, duration: 400, method: "POST", url: "/api/promo", name: "promo", status: 200, type: "fetch", failed: false },
    { id: "r3", time: 9_000, duration: 300, method: "POST", url: "/api/checkout", name: "checkout", status: 500, type: "fetch", failed: true },
  ],
}

export default function CustomStage() {
  return (
    <div style={{ width: "100%", maxWidth: 720 }}>
      <ReplayPreview stage={stage} devtools={devtools} markers mounted />
    </div>
  )
}
