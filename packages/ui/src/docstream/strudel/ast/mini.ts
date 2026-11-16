/* Strudel mini-notation ("bd*2 [~ sd] <c e g>") as a syntax tree with source ranges.
   Written from the grammar Strudel documents (krill), not from its parser: every node carries `start`/`end`
   offsets into the string it was parsed from, so tools can rewrite exactly the characters a node covers. */

export interface Range {
  start: number
  end: number
}

/** A word: a sample or note name, a number, or a rest (`~`, `-`). */
export interface MiniAtom extends Range {
  type: "atom"
  value: string
  rest: boolean
}

/** `[a b c]`: the steps share their parent's step. */
export interface MiniSubcycle extends Range {
  type: "subcycle"
  body: MiniGroup
}

/** `<a b c>`: one step per cycle (layers with `,` each alternate on their own). */
export interface MiniAlternation extends Range {
  type: "alternation"
  layers: MiniSequence[]
}

/** `{a b c, d e}%4`: layers stepped at a shared rate (the first layer's, or `%steps`). */
export interface MiniPolymeter extends Range {
  type: "polymeter"
  layers: MiniSequence[]
  steps: MiniStep | null
}

export type MiniSlice = MiniAtom | MiniSubcycle | MiniAlternation | MiniPolymeter

export type MiniOp =
  | (Range & { op: "fast" | "slow"; amount: MiniStep })
  | (Range & { op: "replicate"; count: number | null })
  | (Range & { op: "weight"; amount: number | null })
  | (Range & { op: "degrade"; amount: number | null })
  | (Range & { op: "euclid"; pulses: MiniStep; steps: MiniStep; rotation: MiniStep | null })
  | (Range & { op: "tail"; value: MiniStep })
  | (Range & { op: "range"; to: MiniStep })

/** One step of a sequence: a slice and the operators written after it (`bd*2`, `c@3`, `hh?`). */
export interface MiniStep extends Range {
  type: "step"
  slice: MiniSlice
  ops: MiniOp[]
}

/** Steps played one after another within the cycle. `^` marks the sequence that sets the step count. */
export interface MiniSequence extends Range {
  type: "sequence"
  steps: MiniStep[]
  marked: boolean
}

/** Sequences played together (`,`), picked at random each cycle (`|`), or concatenated as feet (`.`). */
export interface MiniLayers extends Range {
  type: "stack" | "choose" | "feet"
  layers: MiniSequence[]
}

export type MiniGroup = MiniSequence | MiniLayers
export type MiniNode = MiniGroup | MiniStep | MiniSlice

export class MiniSyntaxError extends Error {
  constructor(message: string, readonly offset: number) {
    super(`${message} at ${offset}`)
    this.name = "MiniSyntaxError"
  }
}

const WS = /[ \n\r\t ]/
const WORD = /[\p{L}\p{Nl}0-9~\-#.^_]/u
const NUMBER = /^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][-+]?[0-9]+)?/

/** Parse a mini-notation string. Throws `MiniSyntaxError` (with the offset) on invalid input. */
export function parseMini(source: string): MiniGroup {
  let i = 0
  const peek = (n = 0) => source[i + n] ?? ""
  const skip = () => {
    while (i < source.length && WS.test(source[i]!)) i++
  }
  const fail = (what: string): never => {
    throw new MiniSyntaxError(i < source.length ? `Unexpected "${source[i]}", expected ${what}` : `Expected ${what}`, i)
  }
  const expect = (ch: string) => {
    skip()
    if (peek() !== ch) fail(`"${ch}"`)
    i++
  }
  const number = (): number | null => {
    const m = NUMBER.exec(source.slice(i))
    if (!m) return null
    i += m[0].length
    return parseFloat(m[0])
  }
  // A separator `.` (feet) is a lone dot between spaces; inside a word it is part of the word ("0.5", "a.b").
  const atFeetDot = () => peek() === "." && peek(1) !== "." && (i === 0 || WS.test(source[i - 1]!)) && (peek(1) === "" || WS.test(peek(1)))

  function word(): MiniAtom | null {
    const start = i
    while (i < source.length && WORD.test(source[i]!)) {
      // ".." starts a range operator, not part of the word.
      if (source[i] === "." && source[i + 1] === ".") break
      i++
    }
    const value = source.slice(start, i)
    if (!value) return null
    if (value === "." || value === "_") {
      i = start
      return null
    }
    return { type: "atom", value, rest: value === "~" || value === "-", start, end: i }
  }

  function slice(): MiniSlice | null {
    skip()
    const start = i
    const ch = peek()
    if (ch === "[") {
      i++
      const body = group(["]"])
      expect("]")
      return { type: "subcycle", body, start, end: i }
    }
    if (ch === "<") {
      i++
      const layers = commaLayers([">"])
      expect(">")
      return { type: "alternation", layers, start, end: i }
    }
    if (ch === "{") {
      i++
      const layers = commaLayers(["}"])
      expect("}")
      let steps: MiniStep | null = null
      if (peek() === "%") {
        i++
        steps = bare() ?? fail("a step count after %")
      }
      return { type: "polymeter", layers, steps, start, end: i }
    }
    if (atFeetDot()) return null
    return word()
  }

  // `*`, `/`, `:`, `..` and `%` take a bare slice: in "bd*2!" the `!` replicates bd, not 2.
  function bare(): MiniStep | null {
    const s = slice()
    return s && { type: "step", slice: s, ops: [], start: s.start, end: s.end }
  }

  // A slice with its operators. `@`, `_` and `!` may stand apart ("a _ _", "a ! !"); the rest attach directly.
  function step(): MiniStep | null {
    const s = slice()
    if (!s) return null
    const ops: MiniOp[] = []
    for (;;) {
      const before = i
      skip()
      const start = i
      const ch = peek()
      if (ch === "@" || (ch === "_" && !WORD.test(peek(1)))) {
        i++
        ops.push({ op: "weight", amount: ch === "@" ? number() : null, start, end: i })
        continue
      }
      if (ch === "!") {
        i++
        ops.push({ op: "replicate", count: number(), start, end: i })
        continue
      }
      i = before
      const at = i
      const c = peek()
      if (c === "*" || c === "/") {
        i++
        const amount = bare() ?? fail("an amount")
        ops.push({ op: c === "*" ? "fast" : "slow", amount, start: at, end: i })
      } else if (c === "?") {
        i++
        ops.push({ op: "degrade", amount: number(), start: at, end: i })
      } else if (c === ":") {
        i++
        const value = bare() ?? fail("a value after :")
        ops.push({ op: "tail", value, start: at, end: i })
      } else if (c === "." && peek(1) === ".") {
        i += 2
        const to = bare() ?? fail("a range end")
        ops.push({ op: "range", to, start: at, end: i })
      } else if (c === "(") {
        i++
        const pulses = step() ?? fail("pulses")
        expect(",")
        const steps = step() ?? fail("steps")
        skip()
        let rotation: MiniStep | null = null
        if (peek() === ",") {
          i++
          rotation = step()
        }
        expect(")")
        ops.push({ op: "euclid", pulses, steps, rotation, start: at, end: i })
      } else {
        break
      }
    }
    return { type: "step", slice: s, ops, start: s.start, end: i }
  }

  function sequence(closers: string[]): MiniSequence {
    skip()
    const start = i
    let marked = false
    if (peek() === "^") {
      marked = true
      i++
    }
    const steps: MiniStep[] = []
    for (;;) {
      skip()
      const ch = peek()
      if (!ch || closers.includes(ch) || ch === "," || ch === "|" || atFeetDot()) break
      const s = step()
      if (!s) fail("a step")
      steps.push(s!)
    }
    if (!steps.length) fail("a step")
    return { type: "sequence", steps, marked, start, end: steps[steps.length - 1]!.end }
  }

  function commaLayers(closers: string[]): MiniSequence[] {
    const layers = [sequence(closers)]
    for (;;) {
      skip()
      if (peek() !== ",") return layers
      i++
      layers.push(sequence(closers))
    }
  }

  function group(closers: string[]): MiniGroup {
    const first = sequence(closers)
    skip()
    const sep = atFeetDot() ? "." : peek()
    if (sep !== "," && sep !== "|" && sep !== ".") return first
    const type = sep === "," ? "stack" : sep === "|" ? "choose" : "feet"
    const layers = [first]
    for (;;) {
      skip()
      const next = atFeetDot() ? "." : peek()
      if (next !== sep) break
      i++
      layers.push(sequence(closers))
    }
    return { type, layers, start: first.start, end: layers[layers.length - 1]!.end }
  }

  const root = group([])
  skip()
  if (i < source.length) fail("end of pattern")
  return root
}

/**
 * Every atom in the tree, in source order. `{ ops: false }` skips operator arguments (the 2 in `bd*2`, the 3,8
 * in `bd(3,8)`), leaving only the values the pattern plays.
 */
export function miniAtoms(node: MiniNode, { ops = true }: { ops?: boolean } = {}): MiniAtom[] {
  const out: MiniAtom[] = []
  const visit = (n: MiniNode | MiniOp | null | undefined) => {
    if (!n) return
    if ("op" in n) {
      if (!ops) return
      if (n.op === "fast" || n.op === "slow") visit(n.amount)
      else if (n.op === "euclid") (visit(n.pulses), visit(n.steps), visit(n.rotation))
      else if (n.op === "tail") visit(n.value)
      else if (n.op === "range") visit(n.to)
      return
    }
    switch (n.type) {
      case "atom":
        out.push(n)
        break
      case "step":
        visit(n.slice)
        n.ops.forEach(visit)
        break
      case "sequence":
        n.steps.forEach(visit)
        break
      case "stack":
      case "choose":
      case "feet":
      case "alternation":
        n.layers.forEach(visit)
        break
      case "polymeter":
        n.layers.forEach(visit)
        visit(n.steps)
        break
      case "subcycle":
        visit(n.body)
        break
    }
  }
  visit(node)
  return out
}

/** The layers of a group: a sequence is one layer. */
export function miniLayers(group: MiniGroup): MiniSequence[] {
  return group.type === "sequence" ? [group] : group.layers
}
