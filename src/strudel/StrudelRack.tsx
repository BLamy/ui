/* The rack: equipment generated from a Strudel song's syntax tree. Every track becomes a device — mute/solo,
   a gain fader, its sound and scale, a step grid for its pattern, and a knob for each effect it uses (plus any
   you add) — and the song gets a master strip with the tempo. Every control edits the code in place (edit.ts),
   so the code stays the source of truth: what you turn is what you'd have typed. */
import { useEffect, useMemo, useState } from "react"
import { AudioWaveform, Drum, KeyboardMusic, Plus, X } from "lucide-react"
import { miniAtoms, type MiniAtom } from "./ast/mini"
import { findCall, parseStrudel, StrudelSyntaxError, type StrudelArg, type StrudelCall, type StrudelSong, type StrudelTrack } from "./ast/program"
import { formatNumber, isAudible, mixCode, removeMethod, setMethod, setMiniAtom, setMiniSource, setTempo, type StrudelMix } from "./ast/edit"
import { Fader, Knob, defaultFormat } from "./controls"
import { StepGrid } from "./StepGrid"

export interface StrudelRackProps {
  code: string
  onChange: (code: string) => void
  /** The code to play for the current mute/solo mix (the written code with silenced tracks). */
  onPlayableChange?: (code: string) => void
  className?: string
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
  onChange: (code: string) => void
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

  const set = (method: string, value: number) => onChange(setMethod(code, chain, method, formatNumber(value)))
  const setAtom = (mini: Mini) => (atom: MiniAtom, text: string) => onChange(setMiniAtom(code, mini, atom, text))

  return (
    <section className="strudel-device" data-kind={track.kind} data-audible={audible} aria-label={name}>
      <header className="strudel-device__head">
        <span className="strudel-device__led" aria-hidden="true" />
        <Icon size={14} aria-hidden="true" />
        <span className="strudel-device__name" title={code.slice(track.start, track.end)}>
          {name}
        </span>
        <button type="button" className="strudel-device__toggle" data-kind="mute" aria-pressed={mix.muted?.has(track.index) || track.muted} onClick={() => onMix("mute")} title="Mute">
          M
        </button>
        <button type="button" className="strudel-device__toggle" data-kind="solo" aria-pressed={!!mix.solo?.has(track.index)} onClick={() => onMix("solo")} title="Solo">
          S
        </button>
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
          onChange={(v) => set("gain", v)}
        />
        <div className="strudel-device__main">
          {(synth || scaleMatch) && (
            <div className="strudel-device__selects strudel-lcd">
              {synth && (
                <label>
                  <span>Sound</span>
                  <select value={synth.value} onChange={(e) => onChange(setMiniAtom(code, sound!, synth, e.target.value))}>
                    {SYNTHS.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              )}
              {scaleMatch && (
                <label>
                  <span>Key</span>
                  <select
                    value={scaleMatch[1]!.toUpperCase().replace(/^([A-G])B$/, "$1b")}
                    onChange={(e) => onChange(setMiniSource(code, scale!, `${e.target.value}${scaleMatch[2]}:${scaleMatch[3]}`))}
                  >
                    {NOTES.map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                  <select value={scaleMatch[3]} onChange={(e) => onChange(setMiniSource(code, scale!, `${scaleMatch[1]}${scaleMatch[2]}:${e.target.value}`))}>
                    {(MODES.includes(scaleMatch[3]!) ? MODES : [scaleMatch[3]!, ...MODES]).map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
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
                    onChange={(v) => set(p, v)}
                  />
                  <button type="button" className="strudel-device__remove" aria-label={`Remove ${spec.label}`} onClick={() => onChange(removeMethod(code, chain, p))}>
                    <X size={10} />
                  </button>
                </div>
              )
            })}
            {missing.length > 0 && (
              <label className="strudel-device__add" title="Add an effect">
                <Plus size={14} aria-hidden="true" />
                <select
                  aria-label={`Add an effect to ${name}`}
                  value=""
                  onChange={(e) => e.target.value && set(e.target.value, STRUDEL_PARAMS[e.target.value]!.default)}
                >
                  <option value="">Add…</option>
                  {missing.map((p) => (
                    <option key={p} value={p}>
                      {STRUDEL_PARAMS[p]!.label} ({p})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Equipment generated from Strudel code. Controlled: `code` in, edited code out through `onChange`. */
export function StrudelRack({ code, onChange, onPlayableChange, className }: StrudelRackProps) {
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

  return (
    <div className={`strudel-rack ${className ?? ""}`.trim()}>
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
          onChange={(v) => onChange(setTempo(song, v))}
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
            onChange={(v) => onChange(setMethod(code, master, "postgain", formatNumber(v)))}
          />
        )}
        <span className="strudel-rack__summary">
          {song.tracks.length} track{song.tracks.length === 1 ? "" : "s"}
          {song.layout === "stack" ? " · stack" : song.layout === "labels" ? " · $:" : ""}
        </span>
      </div>
      {song.tracks.length === 0 && <p className="strudel-rack__error">No pattern found.</p>}
      {song.tracks.map((t) => (
        <Device
          key={t.index}
          song={song}
          track={t}
          mix={mix}
          onChange={onChange}
          onMix={(kind) => (kind === "mute" ? setMuted(toggle(muted, t.index)) : setSolo(toggle(solo, t.index)))}
        />
      ))}
    </div>
  )
}

export default StrudelRack
