/* Exact source edits on a parsed song: each helper returns new code that differs only in the characters the
   change touches, so comments, formatting and everything the rack doesn't understand survive. */
import type { MiniAtom } from "./mini"
import { findCall, type StrudelArg, type StrudelChain, type StrudelSong, type StrudelTrack } from "./program"

export interface CodeEdit {
  start: number
  end: number
  text: string
}

/** Apply non-overlapping edits (in any order). */
export function applyEdits(code: string, edits: CodeEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.start - a.start)
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.end > sorted[i - 1]!.start) throw new Error("Overlapping edits")
  }
  return sorted.reduce((out, e) => out.slice(0, e.start) + e.text + out.slice(e.end), code)
}

/** A compact literal: at most 4 significant decimals, no trailing zeros, `.5` style like hand-written Strudel. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "0"
  const abs = Math.abs(value)
  const digits = abs >= 1000 ? 0 : abs >= 100 ? 1 : abs >= 10 ? 2 : abs >= 1 ? 3 : 4
  let s = String(+value.toFixed(digits))
  if (s.startsWith("0.")) s = s.slice(1)
  else if (s.startsWith("-0.")) s = "-" + s.slice(2)
  return s
}

/** Replace one argument's source text. */
export function setArg(code: string, arg: StrudelArg, text: string): string {
  return applyEdits(code, [{ start: arg.start, end: arg.end, text }])
}

/**
 * Set a method's first argument (`.lpf(800)`), adding `.name(value)` at the end of the chain when it
 * isn't there yet. `value` is source text: pass `formatNumber(n)` or a quoted string.
 */
export function setMethod(code: string, chain: StrudelChain, name: string, value: string): string {
  const call = findCall(chain, name)
  if (!call) return applyEdits(code, [{ start: chain.end, end: chain.end, text: `.${name}(${value})` }])
  const first = call.args[0]
  if (first) return applyEdits(code, [{ start: first.start, end: first.end, text: value }])
  return applyEdits(code, [{ start: call.argsRange.start, end: call.argsRange.end, text: value }])
}

/** Remove every `.name(...)` from the chain. */
export function removeMethod(code: string, chain: StrudelChain, name: string): string {
  const edits = chain.methods.filter((m) => m.name === name).map((m) => ({ ...m.methodRange, text: "" }))
  return edits.length ? applyEdits(code, edits) : code
}

/** Set the tempo in cycles per second, keeping `setcpm` code in cpm; adds `setcps(…)` when there is none. */
export function setTempo(song: StrudelSong, cps: number): string {
  const { code, tempo } = song
  if (!tempo) return `setcps(${formatNumber(cps)})\n${code}`
  const value = tempo.unit === "cpm" ? formatNumber(cps * 60) : formatNumber(cps)
  const first = tempo.call.args[0]
  return first
    ? applyEdits(code, [{ start: first.start, end: first.end, text: value }])
    : applyEdits(code, [{ start: tempo.call.argsRange.start, end: tempo.call.argsRange.end, text: value }])
}

/** Rewrite one atom of a mini-notation string (e.g. a step of a drum row: "hh" ⇄ "~"). */
export function setMiniAtom(code: string, mini: Extract<StrudelArg, { kind: "mini" }>, atom: MiniAtom, text: string): string {
  return applyEdits(code, [{ start: mini.contentStart + atom.start, end: mini.contentStart + atom.end, text }])
}

/** Replace a mini-notation string's contents. */
export function setMiniSource(code: string, mini: Extract<StrudelArg, { kind: "mini" }>, source: string): string {
  return applyEdits(code, [{ start: mini.contentStart, end: mini.end - 1, text: source }])
}

export interface StrudelMix {
  /** Track indexes to silence. */
  muted?: ReadonlySet<number>
  /** When non-empty, only these tracks play. */
  solo?: ReadonlySet<number>
}

/** Whether a track sounds under a mix (its own `_$:` mute included). */
export function isAudible(track: StrudelTrack, mix: StrudelMix = {}): boolean {
  if (track.muted || mix.muted?.has(track.index)) return false
  return !mix.solo?.size || mix.solo.has(track.index)
}

/** The code to play for a mix: silenced tracks become `silence`; the written code is untouched. */
export function mixCode(song: StrudelSong, mix: StrudelMix = {}): string {
  const edits = song.tracks
    .filter((t) => !t.muted && !isAudible(t, mix))
    .map((t) => ({ start: t.start, end: t.end, text: "silence" }))
  return edits.length ? applyEdits(song.code, edits) : song.code
}
