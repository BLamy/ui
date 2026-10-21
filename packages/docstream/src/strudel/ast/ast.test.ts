import { describe, expect, it } from "vitest"
import { MiniSyntaxError, miniAtoms, parseMini, type MiniGroup, type MiniStep } from "./mini"
import { findCall, parseStrudel, StrudelSyntaxError } from "./program"
import { formatNumber, mixCode, removeMethod, setMethod, setMiniAtom, setTempo } from "./edit"

const seq = (g: MiniGroup) => {
  if (g.type !== "sequence") throw new Error(`expected a sequence, got ${g.type}`)
  return g
}
const word = (s: MiniStep) => (s.slice.type === "atom" ? s.slice.value : s.slice.type)

describe("mini-notation", () => {
  it("parses words, rests and ranges", () => {
    const g = seq(parseMini("bd ~ sd:3 -"))
    expect(g.steps.map(word)).toEqual(["bd", "~", "sd", "-"])
    expect(g.steps[2]!.ops).toMatchObject([{ op: "tail", value: { slice: { value: "3" } } }])
    expect(miniAtoms(g).filter((a) => a.rest).map((a) => a.value)).toEqual(["~", "-"])
    const src = "bd ~ sd:3 -"
    for (const a of miniAtoms(g)) expect(src.slice(a.start, a.end)).toBe(a.value)
  })

  it("parses every grouping", () => {
    const g = seq(parseMini("[a b] <c d, e> {f g h, i j}%4"))
    expect(g.steps.map((s) => s.slice.type)).toEqual(["subcycle", "alternation", "polymeter"])
    const poly = g.steps[2]!.slice
    expect(poly.type === "polymeter" && poly.layers.length).toBe(2)
    expect(poly.type === "polymeter" && poly.steps?.slice).toMatchObject({ value: "4" })
    expect(parseMini("a b, c d").type).toBe("stack")
    expect(parseMini("a | b c").type).toBe("choose")
    expect(parseMini("a b . c d").type).toBe("feet")
    expect(seq(parseMini("0.5 1.25")).steps.map(word)).toEqual(["0.5", "1.25"])
  })

  it("parses every operator", () => {
    const g = seq(parseMini("bd*2 hh/4 c@3 e!3 f? g?0.3 bd(3,8,2) 0..7 a _ _ b ! !"))
    const ops = g.steps.map((s) => s.ops.map((o) => o.op))
    expect(ops).toEqual([["fast"], ["slow"], ["weight"], ["replicate"], ["degrade"], ["degrade"], ["euclid"], ["range"], ["weight", "weight"], ["replicate", "replicate"]])
    expect(g.steps[2]!.ops[0]).toMatchObject({ amount: 3 })
    expect(g.steps[5]!.ops[0]).toMatchObject({ amount: 0.3 })
    expect(g.steps[6]!.ops[0]).toMatchObject({ pulses: { slice: { value: "3" } }, steps: { slice: { value: "8" } }, rotation: { slice: { value: "2" } } })
  })

  it("binds operators the way Strudel does", () => {
    // `*` takes a bare slice, so the `!` replicates bd.
    expect(seq(parseMini("bd*2!")).steps[0]!.ops.map((o) => o.op)).toEqual(["fast", "replicate"])
    expect(seq(parseMini("bd*<2 4>")).steps[0]!.ops[0]).toMatchObject({ op: "fast", amount: { slice: { type: "alternation" } } })
    expect(seq(parseMini("^a b")).marked).toBe(true)
  })

  it("reports errors with offsets", () => {
    expect(() => parseMini("[a b")).toThrow(MiniSyntaxError)
    try {
      parseMini("a <b c")
    } catch (e) {
      expect((e as MiniSyntaxError).offset).toBe(6)
    }
    expect(() => parseMini("")).toThrow(MiniSyntaxError)
  })
})

const SONG = `// night drive
setcps(.5)
stack(
  s("bd*2 [~ bd] sd ~, hh*8").gain(.8),
  n("<0 3 4 3>").scale("G2:minor").s("sawtooth").lpf(sine.range(300, 900).slow(8)),
  note("c4 e4 g4").s('piano').room(.4)
).postgain(.9)`

describe("program", () => {
  it("reads tempo, stack tracks and the master chain", () => {
    const song = parseStrudel(SONG)
    expect(song.layout).toBe("stack")
    expect(song.tempo).toMatchObject({ cps: 0.5, unit: "cps" })
    expect(song.tracks.map((t) => [t.kind, t.sound])).toEqual([["drums", "bd"], ["melodic", "sawtooth"], ["melodic", "piano"]])
    expect(song.master.map((m) => m.name)).toEqual(["postgain"])
    const bass = song.tracks[1]!
    expect([("args" in bass.chain.head && bass.chain.head.name), ...bass.chain.methods.map((m) => m.name)]).toEqual(["n", "scale", "s", "lpf"])
    expect(findCall(bass.chain, "lpf")!.args[0]).toMatchObject({ kind: "pattern" })
    expect(findCall(song.tracks[2]!.chain, "s")!.args[0]).toMatchObject({ kind: "string", value: "piano" })
    expect(song.minis.map((m) => m.source)).toEqual(["bd*2 [~ bd] sd ~, hh*8", "<0 3 4 3>", "G2:minor", "sawtooth", "c4 e4 g4"])
  })

  it("reads $: labels, _$: mutes, setcpm and await samples()", () => {
    const song = parseStrudel(`await samples('github:tidalcycles/dirt-samples')
setcpm(120/4)
drums: s("bd sd")
_$: note("c e g").s("square")
$: s("hh*4")`)
    expect(song.layout).toBe("labels")
    expect(song.tempo).toMatchObject({ cps: 0.5, unit: "cpm" })
    expect(song.tracks.map((t) => [t.label, t.muted])).toEqual([["drums", false], [null, true], [null, false]])
  })

  it("treats a lone pattern as one track and survives broken mini-notation", () => {
    const song = parseStrudel(`note("c [e").s("tri")`)
    expect(song.layout).toBe("single")
    expect(song.minis[0]!.mini).toBeNull()
    expect(song.minis[0]!.error).toBeInstanceOf(MiniSyntaxError)
  })

  it("throws on invalid JavaScript", () => {
    expect(() => parseStrudel("stack(")).toThrow(StrudelSyntaxError)
  })
})

describe("edits", () => {
  it("sets, adds and removes methods without touching anything else", () => {
    const song = parseStrudel(SONG)
    const drums = song.tracks[0]!.chain
    expect(setMethod(SONG, drums, "gain", ".5")).toBe(SONG.replace("gain(.8)", "gain(.5)"))
    expect(setMethod(SONG, drums, "room", ".3")).toBe(SONG.replace("gain(.8)", "gain(.8).room(.3)"))
    expect(removeMethod(SONG, song.tracks[2]!.chain, "room")).toBe(SONG.replace(".room(.4)", ""))
  })

  it("edits tempo and mini-notation steps in place", () => {
    const song = parseStrudel(SONG)
    expect(setTempo(song, 0.6)).toBe(SONG.replace("setcps(.5)", "setcps(.6)"))
    expect(setTempo(parseStrudel(`s("bd")`), 0.5)).toBe(`setcps(.5)\ns("bd")`)
    const drums = song.minis[0]!
    const sd = miniAtoms(drums.mini!).find((a) => a.value === "sd")!
    expect(setMiniAtom(SONG, drums, sd, "~")).toBe(SONG.replace("[~ bd] sd ~", "[~ bd] ~ ~"))
  })

  it("silences tracks for a mix", () => {
    const song = parseStrudel(SONG)
    const solo = mixCode(song, { solo: new Set([1]) })
    expect(solo).toContain("stack(\n  silence,\n  n(")
    expect(solo).toContain(",\n  silence\n).postgain")
    expect(mixCode(song)).toBe(SONG)
  })

  it("formats numbers like hand-written Strudel", () => {
    expect([0.5, 0.25, 1, 800, 0.123456, 12.345, -0.5].map(formatNumber)).toEqual([".5", ".25", "1", "800", ".1235", "12.35", "-.5"])
  })
})
