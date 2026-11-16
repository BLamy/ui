/* The rack: equipment generated from a Strudel song's syntax tree. Every track becomes a device — mute/solo,
   a gain fader, its sound and scale, a step grid for its pattern, and a knob for each effect it uses (plus any
   you add) — and the song gets a master strip with the tempo. Every control edits the code in place (edit.ts),
   so the code stays the source of truth: what you turn is what you'd have typed. */
import { useEffect, useMemo, useRef, useState } from "react"
import { AudioWaveform, Drum, KeyboardMusic, Plus, X } from "lucide-react"
import { Menu, MenuContent, MenuItem, MenuTrigger } from "@ui-sdk/react/menu"
import { SegmentedControl, SegmentedControlItem } from "@ui-sdk/react/segmented-control"
import { Select, SelectContent, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@ui-sdk/react/select"
import { Toggle } from "@ui-sdk/react/toggle"
import { miniAtoms, type MiniAtom } from "./ast/mini"
import { findCall, parseStrudel, StrudelSyntaxError, type StrudelArg, type StrudelCall, type StrudelSong, type StrudelTrack } from "./ast/program"
import { formatNumber, isAudible, mixCode, removeMethod, setMethod, setMiniAtom, setMiniSource, setTempo, type StrudelMix } from "./ast/edit"
import { Fader, Knob, defaultFormat } from "./controls"
import type { StrudelRackChangeDetails, StrudelRackChangeReason, StrudelRackControl } from "./rack-types"
import { StepGrid } from "./StepGrid"
import { RackGrid, type GridLayout } from "./RackGrid"

export type { StrudelRackChangeDetails, StrudelRackChangeReason, StrudelRackControl } from "./rack-types"

export interface StrudelRackProps {
  /** The Strudel code the rack is drawn from. Controlled: pass the code `onValueChange` reports. */
  value?: string
  /** @deprecated Use `value`. */
  code?: string
  /** The edited code, and which control edited it and how. */
  onValueChange?: (code: string, details: StrudelRackChangeDetails) => void
  /** @deprecated Use `onValueChange`. Still called, with the same details. */
  onChange?: (code: string, details: StrudelRackChangeDetails) => void
  /** The code to play for the current mute/solo mix (the written code with silenced tracks). */
  onPlayableChange?: (code: string) => void
  className?: string
  /** "rack": modules stacked full width. "grid": a masonry grid you drag and resize. Defaults to "rack". */
  layout?: "rack" | "grid"
  /** Remember the layout (mode, order and sizes) in localStorage under this key. */
  persistKey?: string
}

interface Saved {
  mode: "rack" | "grid"
  grid: GridLayout
}

function load(key: string | undefined): Partial<Saved> {
  if (!key) return {}
  try {
    return JSON.parse(localStorage.getItem(`strudel-rack:${key}`) ?? "{}") as Partial<Saved>
  } catch {
    return {}
  }
}

interface Param {
  label: string
  min: number
  max: number
  default: number
  log?: boolean
  format?: (v: number) => string
}

const hz = (v: number) => (v >= 1000 ? `${+(v / 1000).toFixed(1)}k` : v.toFixed(0))
const pct = (v: number) => `${Math.round(v * 100)}`

/** Effects the rack knows how to draw, in display order. Others still parse; they just get no knob. */
export const STRUDEL_PARAMS: Record<string, Param> = {
  lpf: { label: "Cutoff", min: 40, max: 16000, default: 1200, log: true, format: hz },
  cutoff: { label: "Cutoff", min: 40, max: 16000, default: 1200, log: true, format: hz },
  lpq: { label: "Reso", min: 0, max: 30, default: 5 },
  hpf: { label: "Low cut", min: 20, max: 8000, default: 200, log: true, format: hz },
  attack: { label: "Attack", min: 0, max: 2, default: 0.01 },
  decay: { label: "Decay", min: 0, max: 2, default: 0.2 },
  sustain: { label: "Sustain", min: 0, max: 1, default: 0.6, format: pct },
  release: { label: "Release", min: 0, max: 4, default: 0.3 },
  vib: { label: "Vibrato", min: 0, max: 16, default: 4 },
  vibmod: { label: "Vib depth", min: 0, max: 2, default: 0.2 },
  shape: { label: "Shape", min: 0, max: 1, default: 0.3, format: pct },
  distort: { label: "Drive", min: 0, max: 5, default: 0.5 },
  crush: { label: "Crush", min: 1, max: 16, default: 4 },
  coarse: { label: "Coarse", min: 1, max: 32, default: 4 },
  speed: { label: "Speed", min: -2, max: 4, default: 1 },
  pan: { label: "Pan", min: 0, max: 1, default: 0.5, format: (v) => (Math.abs(v - 0.5) < 0.02 ? "C" : v < 0.5 ? `L${Math.round((0.5 - v) * 200)}` : `R${Math.round((v - 0.5) * 200)}`) },
  room: { label: "Reverb", min: 0, max: 1, default: 0.4, format: pct },
  size: { label: "Size", min: 0, max: 8, default: 2 },
  delay: { label: "Delay", min: 0, max: 1, default: 0.3, format: pct },
  delaytime: { label: "Time", min: 0.01, max: 1, default: 0.25, log: true },
  delayfeedback: { label: "Feedback", min: 0, max: 0.95, default: 0.5, format: pct },
}

const SYNTHS = ["sine", "triangle", "square", "sawtooth", "supersaw", "pulse", "white", "pink", "brown"]
const NOTES = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]
const MODES = ["major", "minor", "dorian", "phrygian", "lydian", "mixolydian", "aeolian", "locrian", "major pentatonic", "minor pentatonic", "chromatic", "whole tone", "harmonic minor", "melodic minor", "blues"]

type Mini = Extract<StrudelArg, { kind: "mini" }>

const firstNumber = (call: StrudelCall | null) => (call?.args[0]?.kind === "number" ? call.args[0].value : null)
const staticMini = (call: StrudelCall | null): Mini | null => {
  const a = call?.args[0]
  return a?.kind === "mini" && a.mini ? a : null
}

/** A name for a track: its label, the sounds of a drum row, or its role and synth. */
export function trackName(track: StrudelTrack): string {
  if (track.label) return track.label
  const head = "args" in track.chain.head ? track.chain.head : null
  if (track.kind === "drums") {
    const mini = staticMini(findCall(track.chain, "s") ?? findCall(track.chain, "sound"))
    const names = mini ? [...new Set(miniAtoms(mini.mini!, { ops: false }).filter((a) => !a.rest).map((a) => a.value.split(":")[0]!))] : []
    return names.length ? names.slice(0, 4).join(" · ") : "Drums"
  }
  const scale = staticMini(findCall(track.chain, "scale"))
  const octave = Number(/(\d)/.exec(scale?.source ?? "")?.[1] ?? NaN)
  const chords = staticMini(head)?.source.includes(",")
  const role = chords ? "Chords" : octave <= 2 ? "Bass" : octave >= 4 ? "Lead" : head?.name === "note" || head?.name === "n" ? "Keys" : "Synth"
  return track.sound ? `${role} · ${track.sound}` : role
}

/** One of the LCD's choices: a select named by the label before it, or by `name` when it has none of its own. */
function RackSelect({ label, name, value, options, onChange }: {
  label?: string
  name?: string
  value: string
  options: readonly string[]
  onChange: (value: string, how: { reason: "item-press" | "list-navigation"; event?: Event }) => void
}) {
  return (
    <Select
      items={[...options]}
      value={value}
      onValueChange={(next, { reason, event }) => {
        if (typeof next === "string" && (reason === "item-press" || reason === "list-navigation")) onChange(next, { reason, ...(event ? { event } : {}) })
      }}
    >
      {label ? <SelectLabel render={<span />} className="strudel-select__label">{label}</SelectLabel> : null}
      <SelectTrigger className="strudel-select" aria-label={name}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="strudel-popup" align="start" sideOffset={8}>
        {options.map((option) => (
          <SelectItem key={option} value={option} className="strudel-popup__item">
            {option}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Device({
  song,
  track,
  mix,
  onMix,
  onChange,
}: {
  song: StrudelSong
  track: StrudelTrack
  mix: StrudelMix
  onMix: (kind: "mute" | "solo") => void
  onChange: (code: string, details: StrudelRackChangeDetails) => void
}) {
  const { code } = song
  const chain = track.chain
  const head = "args" in chain.head ? chain.head : null
  const pattern = staticMini(head) ?? (chain.head.name === "" && "literal" in chain.head && chain.head.literal?.kind === "mini" ? chain.head.literal : null)
  const soundCall = findCall(chain, "s") ?? findCall(chain, "sound")
  const sound = staticMini(soundCall)
  const soundAtoms = sound ? miniAtoms(sound.mini!, { ops: false }) : []
  const synth = soundAtoms.length === 1 && SYNTHS.includes(soundAtoms[0]!.value) ? soundAtoms[0]! : null
  const scale = staticMini(findCall(chain, "scale"))
  const scaleMatch = scale ? /^([A-Ga-g][#b]?)(\d*):(.+)$/.exec(scale.source) : null
  const gainCall = findCall(chain, "gain")
  const gain = firstNumber(gainCall)
  const present = Object.keys(STRUDEL_PARAMS).filter((p) => findCall(chain, p))
  const missing = Object.keys(STRUDEL_PARAMS).filter((p) => !present.includes(p) && p !== "cutoff")
  const audible = isAudible(track, mix)
  const name = trackName(track)
  const Icon = track.kind === "drums" ? Drum : track.kind === "melodic" ? KeyboardMusic : AudioWaveform

    type How = { reason: StrudelRackChangeReason; event?: Event }
  const emit = (next: string, control: StrudelRackControl, { reason, event }: How, param?: string) =>
    onChange(next, { reason, ...(event ? { event } : {}), control, track: track.index, ...(param ? { param } : {}) })
  const set = (method: string, value: number, control: StrudelRackControl, how: How) =>
    emit(setMethod(code, chain, method, formatNumber(value)), control, how, control === "effect" ? method : undefined)
  const setAtom = (mini: Mini) => (atom: MiniAtom, text: string, how: How) => emit(setMiniAtom(code, mini, atom, text), "steps", how)

  return (
    <section className="strudel-device" data-kind={track.kind} data-audible={audible} aria-label={name}>
      <header className="strudel-device__head">
        <span className="strudel-device__led" aria-hidden="true" />
        <Icon size={14} aria-hidden="true" />
        <span className="strudel-device__name" title={code.slice(track.start, track.end)}>
          {name}
        </span>
        <Toggle className="strudel-device__toggle" data-kind="mute" pressed={!!(mix.muted?.has(track.index) || track.muted)} onPressedChange={() => onMix("mute")} aria-label="Mute" title="Mute">
          M
        </Toggle>
        <Toggle className="strudel-device__toggle" data-kind="solo" pressed={!!mix.solo?.has(track.index)} onPressedChange={() => onMix("solo")} aria-label="Solo" title="Solo">
          S
        </Toggle>
      </header>
      <div className="strudel-device__body">
        <Fader
          label="Gain"
          value={gain ?? 1}
          min={0}
          max={1.5}
          defaultValue={1}
          disabled={!!gainCall && gain === null}
          {...(gainCall && gain === null ? { display: "∿", title: "Modulated by a pattern" } : {})}
          format={pct}
          onValueChange={(v, how) => set("gain", v, "gain", how)}
        />
        <div className="strudel-device__main">
          {(synth || scaleMatch) && (
            <div className="strudel-device__selects strudel-lcd">
              {synth && (
                <div className="strudel-device__field">
                  <RackSelect label="Sound" value={synth.value} options={SYNTHS} onChange={(value, how) => emit(setMiniAtom(code, sound!, synth, value), "sound", how)} />
                </div>
              )}
              {scaleMatch && (
                <div className="strudel-device__field">
                  <RackSelect
                    label="Key"
                    value={scaleMatch[1]!.toUpperCase().replace(/^([A-G])B$/, "$1b")}
                    options={NOTES}
                    onChange={(value, how) => emit(setMiniSource(code, scale!, `${value}${scaleMatch[2]}:${scaleMatch[3]}`), "key", how)}
                  />
                  <RackSelect
                    name="Scale"
                    value={scaleMatch[3]!}
                    options={MODES.includes(scaleMatch[3]!) ? MODES : [scaleMatch[3]!, ...MODES]}
                    onChange={(value, how) => emit(setMiniSource(code, scale!, `${scaleMatch[1]}${scaleMatch[2]}:${value}`), "scale", how)}
                  />
                </div>
              )}
            </div>
          )}
          {pattern?.mini && <StepGrid mini={pattern.mini} onAtomChange={setAtom(pattern)} label={`${name} steps`} />}
          {!pattern && sound?.mini && !synth && <StepGrid mini={sound.mini} onAtomChange={setAtom(sound)} label={`${name} sounds`} />}
          {pattern?.error && <p className="strudel-device__error">{pattern.error.message}</p>}
          <div className="strudel-device__knobs">
            {present.map((p) => {
              const call = findCall(chain, p)!
              const value = firstNumber(call)
              const spec = STRUDEL_PARAMS[p]!
              return (
                <div key={p} className="strudel-device__knob">
                  <Knob
                    label={spec.label}
                    value={value ?? spec.default}
                    min={spec.min}
                    max={spec.max}
                    {...(spec.log ? { log: true } : {})}
                    defaultValue={spec.default}
                    format={spec.format ?? defaultFormat}
                    disabled={value === null}
                    {...(value === null ? { display: "∿", title: `${p} is modulated: ${code.slice(call.argsRange.start, call.argsRange.end)}` } : {})}
                    onValueChange={(v, how) => set(p, v, "effect", how)}
                  />
                  <button type="button" className="strudel-device__remove" aria-label={`Remove ${spec.label}`} onClick={(event) => emit(removeMethod(code, chain, p), "effect", { reason: "remove-press", event: event.nativeEvent }, p)}>
                    <X size={10} />
                  </button>
                </div>
              )
            })}
            {missing.length > 0 && (
              <Menu onAction={(effect, { event }) => set(effect, STRUDEL_PARAMS[effect]!.default, "effect", { reason: "item-press", ...(event ? { event } : {}) })}>
                <MenuTrigger className="strudel-device__add" aria-label={`Add an effect to ${name}`} title="Add an effect">
                  <Plus size={14} aria-hidden="true" />
                </MenuTrigger>
                <MenuContent className="strudel-popup" align="start" sideOffset={8}>
                  {missing.map((p) => (
                    <MenuItem key={p} value={p} label={STRUDEL_PARAMS[p]!.label} className="strudel-popup__item">
                      {STRUDEL_PARAMS[p]!.label} <span className="strudel-popup__hint">{p}</span>
                    </MenuItem>
                  ))}
                </MenuContent>
              </Menu>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Equipment generated from Strudel code. Controlled: `value` in, edited code out through `onValueChange` (with what edited it). */
export function StrudelRack({ value, code: legacyCode, onValueChange, onChange: legacyOnChange, onPlayableChange, className, layout = "rack", persistKey }: StrudelRackProps) {
  const code = value ?? legacyCode ?? ""
  const onChange = (next: string, details: StrudelRackChangeDetails) => {
    onValueChange?.(next, details)
    legacyOnChange?.(next, details)
  }
  const [saved] = useState(() => load(persistKey))
  const [mode, setMode] = useState<"rack" | "grid">(saved.mode ?? layout)
  const [grid, setGrid] = useState<GridLayout>(saved.grid ?? { order: [], sizes: {} })
  // The master strip, and the switch in it, mounts again in the other layout: focus goes back to the switch.
  const layoutSwitch = useRef<HTMLDivElement>(null)
  const switched = useRef(false)
  useEffect(() => {
    if (!switched.current) return
    switched.current = false
    layoutSwitch.current?.querySelector<HTMLElement>('[data-slot="segmented-control-item"][data-checked]')?.focus()
  }, [mode])
  useEffect(() => {
    if (!persistKey) return
    try {
      localStorage.setItem(`strudel-rack:${persistKey}`, JSON.stringify({ mode, grid } satisfies Saved))
    } catch {
      // Storage unavailable (private mode): the layout just isn't remembered.
    }
  }, [persistKey, mode, grid])
  const parsed = useMemo((): { song: StrudelSong } | { error: string } => {
    try {
      return { song: parseStrudel(code) }
    } catch (err) {
      return { error: err instanceof StrudelSyntaxError ? `Syntax error: ${err.message}` : String(err) }
    }
  }, [code])
  const [muted, setMuted] = useState<ReadonlySet<number>>(() => new Set())
  const [solo, setSolo] = useState<ReadonlySet<number>>(() => new Set())
  const song = "song" in parsed ? parsed.song : null
  const mix = useMemo(() => ({ muted, solo }), [muted, solo])

  useEffect(() => {
    if (song) onPlayableChange?.(mixCode(song, mix))
  }, [song, mix])

  if (!song) {
    return (
      <div className={`strudel-rack ${className ?? ""}`.trim()}>
        <p className="strudel-rack__error" role="alert">
          {"error" in parsed ? parsed.error : ""}
        </p>
      </div>
    )
  }

  const toggle = (set: ReadonlySet<number>, i: number) => {
    const next = new Set(set)
    if (!next.delete(i)) next.add(i)
    return next
  }
  const cps = song.tempo?.cps
  const master = song.masterChain
  const postgain = master ? firstNumber(findCall(master, "postgain")) : null

  const masterStrip = (
      <div className="strudel-rack__master" role="group" aria-label="Master">
        <span className="strudel-rack__title">
          Master
          <small>Strudel</small>
        </span>
        <output className="strudel-lcd strudel-lcd--bpm" aria-label="Tempo">
          {Math.round((cps && Number.isFinite(cps) ? cps : 0.5) * 2400) / 10}
          <small>BPM</small>
        </output>
        <Knob
          size="lg"
          label="Tempo"
          value={cps && Number.isFinite(cps) ? cps : 0.5}
          min={0.1}
          max={2}
          defaultValue={0.5}
          format={(v) => `${Math.round(v * 240)} bpm`}
          onValueChange={(v, { reason, event }) => onChange(setTempo(song, v), { reason, ...(event ? { event } : {}), control: "tempo" })}
        />
        {master && (
          <Knob
            size="lg"
            label="Output"
            value={postgain ?? 1}
            min={0}
            max={2}
            defaultValue={1}
            format={pct}
            onValueChange={(v, { reason, event }) => onChange(setMethod(code, master, "postgain", formatNumber(v)), { reason, ...(event ? { event } : {}), control: "output" })}
          />
        )}
        <span className="strudel-rack__summary">
          {song.tracks.length} track{song.tracks.length === 1 ? "" : "s"}
          {song.layout === "stack" ? " · stack" : song.layout === "labels" ? " · $:" : ""}
        </span>
        <SegmentedControl
          className="strudel-rack__mode"
          aria-label="Layout"
          ref={layoutSwitch}
          value={mode}
          onValueChange={(next) => {
            if (next !== "rack" && next !== "grid") return
            switched.current = true
            setMode(next)
          }}
        >
          {(["rack", "grid"] as const).map((m) => (
            <SegmentedControlItem key={m} value={m}>
              {m}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </div>
  )
  const devices = song.tracks.map((t) => ({
    key: `track-${t.index}`,
    label: trackName(t),
    span: 6,
    node: (
      <Device
        song={song}
        track={t}
        mix={mix}
        onChange={onChange}
        onMix={(kind) => (kind === "mute" ? setMuted(toggle(muted, t.index)) : setSolo(toggle(solo, t.index)))}
      />
    ),
  }))

  return (
    <div className={`strudel-rack ${className ?? ""}`.trim()} data-mode={mode}>
      {mode === "grid" ? (
        <RackGrid items={[{ key: "master", label: "Master", span: 12, node: masterStrip }, ...devices]} layout={grid} onLayoutChange={setGrid} />
      ) : (
        <>
          {masterStrip}
          {devices.map((d) => (
            <div key={d.key}>{d.node}</div>
          ))}
        </>
      )}
      {song.tracks.length === 0 && <p className="strudel-rack__error">No pattern found.</p>}
    </div>
  )
}

export default StrudelRack
