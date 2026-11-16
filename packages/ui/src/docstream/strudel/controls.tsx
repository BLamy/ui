/* The rack's hardware: a rotary knob (rubber skirt, machined cap, LED ring) and a channel fader (slotted
   track, tick scale, chunky cap). The fader is UI SDK's Slider, standing up; the knob is the `knob` primitive
   (knob.ts), as UI SDK has no rotary control. Both take the arrow keys, Page Up/Down, Home/End and a drag,
   and a double-click resets to the default. Values map logarithmically when `log`. */
import { useId } from "react"
import { fractionOf, valueAt } from "@ui-sdk/core/number"
import { Slider, SliderControl, SliderThumb, SliderTrack, SliderValue } from "@ui-sdk/react/slider"
import { KnobDial, KnobRoot, KnobValue } from "./knob-parts"
import type { ControlValueChangeDetails } from "./rack-types"

export type { ControlValueChangeDetails, ControlValueChangeReason } from "./rack-types"

export interface ControlProps {
  label: string
  value: number
  min: number
  max: number
  /** Map the travel logarithmically (frequencies). */
  log?: boolean
  defaultValue?: number
  format?: (value: number) => string
  /** The new value, and why it changed. */
  onValueChange?: (value: number, details: ControlValueChangeDetails) => void
  disabled?: boolean
  /** Shown instead of the value, e.g. "∿" for a modulated parameter. */
  display?: string
  title?: string
  /** Knob only: `"lg"` for master controls (default `"default"`). */
  size?: "default" | "lg"
}

/** Calls `onValueChange`. */
function reporter({ onValueChange }: Pick<ControlProps, "onValueChange">) {
  return (value: number, details: ControlValueChangeDetails) => {
    onValueChange?.(value, details)
  }
}

const scaleOf = ({ min, log }: Pick<ControlProps, "min" | "log">) => (log && min > 0 ? "log" : "linear")

export function defaultFormat(v: number): string {
  const a = Math.abs(v)
  if (a >= 1000) return `${+(v / 1000).toFixed(1)}k`
  if (a >= 100) return v.toFixed(0)
  if (a >= 10) return v.toFixed(1)
  return v.toFixed(2)
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
  const { display } = props
  // A bipolar parameter (pan, speed) lights from the centre; the rest light from the left.
  const bipolar = props.min < 0 || props.label === "Pan"
  const zero = bipolar ? fractionOf(props.min < 0 ? 0 : (props.min + props.max) / 2, props, scaleOf(props)) : 0
  return (
    <KnobRoot
      className="strudel-knob"
      data-size={props.size ?? "default"}
      value={props.value}
      onValueChange={reporter(props)}
      min={props.min}
      max={props.max}
      scale={scaleOf(props)}
      resetValue={props.defaultValue}
      disabled={props.disabled}
      valueText={(value) => display ?? format(value)}
    >
      <KnobDial className="strudel-knob__dial" aria-label={props.label} title={props.title}>
        {({ fraction: u, disabled }) => {
          const lit = (i: number) => {
            const t = i / (LEDS - 1)
            return !disabled && (bipolar ? t >= Math.min(zero, u) - 0.001 && t <= Math.max(zero, u) + 0.001 : t <= u + 0.001)
          }
          return (
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
              <g transform={`rotate(${-ARC / 2 + ARC * u} 30 30)`}>
                {Array.from({ length: 24 }, (_, i) => (
                  <line key={i} x1="30" y1="11.6" x2="30" y2="14" transform={`rotate(${i * 15} 30 30)`} className="strudel-knob__ridge" />
                ))}
                <circle cx="30" cy="30" r="12.5" fill={`url(#${id}-cap)`} className="strudel-knob__cap" />
                <circle cx="30" cy="30" r="12.5" className="strudel-knob__brush" />
                <line x1="30" y1="19.5" x2="30" y2="26" className="strudel-knob__pointer" />
              </g>
            </svg>
          )
        }}
      </KnobDial>
      <KnobValue className="strudel-knob__value">{({ text }) => text}</KnobValue>
      <span className="strudel-knob__label">{props.label}</span>
    </KnobRoot>
  )
}

const TICKS = [10, 8, 6, 4, 2, 0]

export function Fader(props: ControlProps) {
  const format = props.format ?? defaultFormat
  const scale = scaleOf(props)
  const { display, defaultValue, disabled } = props
  const report = reporter(props)
  // The slider runs along the fader's travel, 0 to 1, so a log scale moves evenly.
  return (
    <Slider
      className="strudel-fader"
      orientation="vertical"
      min={0}
      max={1}
      step={0.01}
      largeStep={0.1}
      value={fractionOf(props.value, props, scale)}
      onValueChange={(position, details) => report(valueAt(position as number, props, scale), details)}
      disabled={disabled}
      format={(position) => display ?? format(valueAt(position, props, scale))}
      title={props.title}
    >
      <SliderValue className="strudel-fader__value" />
      <div className="strudel-fader__body">
        <div className="strudel-fader__scale" aria-hidden="true">
          {TICKS.map((t) => (
            <span key={t}>{t}</span>
          ))}
        </div>
        <SliderControl
          className="strudel-fader__track"
          onDoubleClick={(event) => {
            if (!disabled && defaultValue !== undefined) report(defaultValue, { reason: "reset-press", event: event.nativeEvent })
          }}
        >
          <div className="strudel-fader__slot" />
          <SliderTrack className="strudel-fader__travel">
            <SliderThumb className="strudel-fader__cap" aria-label={props.label} />
          </SliderTrack>
        </SliderControl>
      </div>
      <span className="strudel-fader__label">{props.label}</span>
    </Slider>
  )
}
