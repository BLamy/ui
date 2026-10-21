/* The rack's hardware: a rotary knob (rubber skirt, machined cap, LED ring) and a channel fader (slotted
   track, tick scale, chunky cap). Both are ARIA sliders — drag (Shift for fine), arrow keys, Page Up/Down,
   Home/End — and double-click resets to the default. Values map logarithmically when `log`. */
import { useId, useRef, type KeyboardEvent, type PointerEvent } from "react"

export interface ControlProps {
  label: string
  value: number
  min: number
  max: number
  /** Map the travel logarithmically (frequencies). */
  log?: boolean
  defaultValue?: number
  format?: (value: number) => string
  onChange: (value: number) => void
  disabled?: boolean
  /** Shown instead of the value, e.g. "∿" for a modulated parameter. */
  display?: string
  title?: string
  /** Knob only: "lg" for master controls. */
  size?: "md" | "lg"
}

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))

function toUnit(v: number, { min, max, log }: Pick<ControlProps, "min" | "max" | "log">) {
  if (log && min > 0) return Math.log(clamp(v, min, max) / min) / Math.log(max / min)
  return (clamp(v, min, max) - min) / (max - min)
}

function fromUnit(u: number, { min, max, log }: Pick<ControlProps, "min" | "max" | "log">) {
  const t = clamp(u, 0, 1)
  return log && min > 0 ? min * (max / min) ** t : min + t * (max - min)
}

export function defaultFormat(v: number): string {
  const a = Math.abs(v)
  if (a >= 1000) return `${+(v / 1000).toFixed(1)}k`
  if (a >= 100) return v.toFixed(0)
  if (a >= 10) return v.toFixed(1)
  return v.toFixed(2)
}

function useDrag(props: ControlProps, travel: number) {
  const start = useRef<{ pos: number; unit: number } | null>(null)
  const set = (unit: number) => props.onChange(fromUnit(unit, props))
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (props.disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    start.current = { pos: e.clientY, unit: toUnit(props.value, props) }
  }
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const s = start.current
    if (!s) return
    set(s.unit + ((s.pos - e.clientY) / travel) * (e.shiftKey ? 0.2 : 1))
  }
  const onPointerUp = () => {
    start.current = null
  }
  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (props.disabled) return
    const u = toUnit(props.value, props)
    const step = e.shiftKey ? 0.01 : 0.05
    const next: Record<string, number> = {
      ArrowUp: u + step,
      ArrowRight: u + step,
      ArrowDown: u - step,
      ArrowLeft: u - step,
      PageUp: u + 0.2,
      PageDown: u - 0.2,
      Home: 0,
      End: 1,
    }
    if (!(e.key in next)) return
    e.preventDefault()
    set(next[e.key]!)
  }
  const onDoubleClick = () => {
    if (!props.disabled && props.defaultValue !== undefined) props.onChange(props.defaultValue)
  }
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onKeyDown, onDoubleClick }
}

function aria(props: ControlProps, format: (v: number) => string) {
  return {
    role: "slider",
    tabIndex: props.disabled ? -1 : 0,
    "aria-label": props.label,
    "aria-valuemin": props.min,
    "aria-valuemax": props.max,
    "aria-valuenow": +props.value.toFixed(4),
    "aria-valuetext": props.display ?? format(props.value),
    "aria-disabled": props.disabled || undefined,
    title: props.title,
  } as const
}

const ARC = 270
const LEDS = 15
const polar = (deg: number, r: number, c = 30) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [c + r * Math.cos(a), c + r * Math.sin(a)] as const
}

export function Knob(props: ControlProps) {
  const id = useId().replace(/:/g, "")
  const format = props.format ?? defaultFormat
  const handlers = useDrag(props, 160)
  const u = toUnit(props.value, props)
  const angle = -ARC / 2 + ARC * u
  // A bipolar parameter (pan, speed) lights from the centre; the rest light from the left.
  const bipolar = props.min < 0 || props.label === "Pan"
  const zero = bipolar ? toUnit(props.min < 0 ? 0 : (props.min + props.max) / 2, props) : 0
  const lit = (i: number) => {
    const t = i / (LEDS - 1)
    return !props.disabled && (bipolar ? (t >= Math.min(zero, u) - 0.001 && t <= Math.max(zero, u) + 0.001) : t <= u + 0.001)
  }
  return (
    <div className="strudel-knob" data-size={props.size ?? "md"} data-disabled={props.disabled || undefined}>
      <div className="strudel-knob__dial" {...aria(props, format)} {...handlers}>
        <svg viewBox="0 0 60 60" aria-hidden="true">
          <defs>
            <radialGradient id={`${id}-skirt`} cx="50%" cy="35%" r="70%">
              <stop offset="0" stopColor="#4a4d55" />
              <stop offset=".6" stopColor="#1d1f24" />
              <stop offset="1" stopColor="#0b0c0e" />
            </radialGradient>
            <linearGradient id={`${id}-cap`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f2f3f5" />
              <stop offset=".45" stopColor="#a9adb5" />
              <stop offset=".55" stopColor="#8a8f98" />
              <stop offset="1" stopColor="#d7dae0" />
            </linearGradient>
          </defs>
          {Array.from({ length: LEDS }, (_, i) => {
            const [x, y] = polar(-ARC / 2 + (ARC * i) / (LEDS - 1), 27)
            return <circle key={i} cx={x} cy={y} r="1.7" className="strudel-knob__led" data-on={lit(i) || undefined} />
          })}
          <circle cx="30" cy="31.5" r="19.5" className="strudel-knob__shadow" />
          <circle cx="30" cy="30" r="19" fill={`url(#${id}-skirt)`} className="strudel-knob__skirt" />
          {/* Grip ridges on the skirt, then the machined cap and its indicator. */}
          <g transform={`rotate(${angle} 30 30)`}>
            {Array.from({ length: 24 }, (_, i) => (
              <line key={i} x1="30" y1="11.6" x2="30" y2="14" transform={`rotate(${i * 15} 30 30)`} className="strudel-knob__ridge" />
            ))}
            <circle cx="30" cy="30" r="12.5" fill={`url(#${id}-cap)`} className="strudel-knob__cap" />
            <circle cx="30" cy="30" r="12.5" className="strudel-knob__brush" />
            <line x1="30" y1="19.5" x2="30" y2="26" className="strudel-knob__pointer" />
          </g>
        </svg>
      </div>
      <span className="strudel-knob__value">{props.display ?? format(props.value)}</span>
      <span className="strudel-knob__label">{props.label}</span>
    </div>
  )
}

const TICKS = [10, 8, 6, 4, 2, 0]

export function Fader(props: ControlProps) {
  const format = props.format ?? defaultFormat
  const handlers = useDrag(props, 104)
  const u = toUnit(props.value, props)
  return (
    <div className="strudel-fader" data-disabled={props.disabled || undefined}>
      <span className="strudel-fader__value">{props.display ?? format(props.value)}</span>
      <div className="strudel-fader__body">
        <div className="strudel-fader__scale" aria-hidden="true">
          {TICKS.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <div className="strudel-fader__track" {...aria(props, format)} {...handlers} aria-orientation="vertical">
          <div className="strudel-fader__slot" />
          <div className="strudel-fader__cap" style={{ bottom: `calc(${u} * (100% - 22px))` }} />
        </div>
      </div>
      <span className="strudel-fader__label">{props.label}</span>
    </div>
  )
}
