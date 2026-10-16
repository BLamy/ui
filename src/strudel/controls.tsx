/* The rack's hardware: a rotary knob and a fader. Both are ARIA sliders — drag (Shift for fine), arrow keys,
   Page Up/Down, Home/End — and double-click resets to the default. Values map logarithmically when `log`. */
import { useRef, type KeyboardEvent, type PointerEvent } from "react"

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

function useDrag(props: ControlProps, axis: "x" | "y", travel: number) {
  const start = useRef<{ pos: number; unit: number } | null>(null)
  const set = (unit: number) => props.onChange(fromUnit(unit, props))
  const onPointerDown = (e: PointerEvent<HTMLElement>) => {
    if (props.disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    e.currentTarget.focus()
    start.current = { pos: axis === "y" ? e.clientY : e.clientX, unit: toUnit(props.value, props) }
  }
  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const s = start.current
    if (!s) return
    const delta = axis === "y" ? s.pos - e.clientY : e.clientX - s.pos
    set(s.unit + (delta / travel) * (e.shiftKey ? 0.2 : 1))
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
const polar = (deg: number, r: number) => {
  const a = ((deg - 90) * Math.PI) / 180
  return [20 + r * Math.cos(a), 20 + r * Math.sin(a)] as const
}
const arc = (from: number, to: number, r: number) => {
  const [x1, y1] = polar(from, r)
  const [x2, y2] = polar(to, r)
  return `M ${x1} ${y1} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x2} ${y2}`
}

export function Knob(props: ControlProps) {
  const format = props.format ?? defaultFormat
  const handlers = useDrag(props, "y", 160)
  const u = toUnit(props.value, props)
  const from = -ARC / 2
  const to = from + ARC * u
  const [px, py] = polar(to, 11)
  return (
    <div className="strudel-knob" data-disabled={props.disabled || undefined}>
      <div className="strudel-knob__dial" {...aria(props, format)} {...handlers}>
        <svg viewBox="0 0 40 40" aria-hidden="true">
          <path d={arc(from, from + ARC, 16)} className="strudel-knob__track" />
          {!props.disabled && u > 0.001 && <path d={arc(from, to, 16)} className="strudel-knob__fill" />}
          <circle cx="20" cy="20" r="11.5" className="strudel-knob__cap" />
          <line x1="20" y1="20" x2={px} y2={py} className="strudel-knob__pointer" />
        </svg>
      </div>
      <span className="strudel-knob__value">{props.display ?? format(props.value)}</span>
      <span className="strudel-knob__label">{props.label}</span>
    </div>
  )
}

export function Fader(props: ControlProps) {
  const format = props.format ?? defaultFormat
  const handlers = useDrag(props, "y", 90)
  const u = toUnit(props.value, props)
  return (
    <div className="strudel-fader" data-disabled={props.disabled || undefined}>
      <span className="strudel-fader__value">{props.display ?? format(props.value)}</span>
      <div className="strudel-fader__track" {...aria(props, format)} {...handlers} aria-orientation="vertical">
        <div className="strudel-fader__fill" style={{ height: `${u * 100}%` }} />
        <div className="strudel-fader__thumb" style={{ bottom: `calc(${u * 100}% - 5px)` }} />
      </div>
      <span className="strudel-fader__label">{props.label}</span>
    </div>
  )
}
