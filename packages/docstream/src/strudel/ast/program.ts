/* A Strudel program as a song: the JavaScript is parsed with acorn (the parser Strudel's own transpiler uses) and
   read the way the REPL runs it — `setcps`/`setcpm` set the tempo, `$:` labels or a top-level `stack(...)` hold
   the tracks, and each track is a method chain (`n("0 2").scale("C:minor").s("sawtooth").lpf(800)`) whose string
   arguments are parsed as mini-notation. Every node keeps its source range for exact edits (see edit.ts). */
import { parse as parseJs, type Node as AcornNode } from "acorn"
import { MiniSyntaxError, miniAtoms, parseMini, type MiniGroup, type Range } from "./mini"

export type { Range }

interface EsNode extends Range {
  type: string
  [key: string]: unknown
}

export type StrudelArg = Range &
  (
    | { kind: "number"; value: number }
    /** A double-quoted or backtick string: mini-notation. `mini` is null when it doesn't parse (see `error`). */
    | { kind: "mini"; source: string; contentStart: number; mini: MiniGroup | null; error: MiniSyntaxError | null }
    /** A single-quoted string: plain JavaScript text, as in the Strudel REPL. */
    | { kind: "string"; value: string }
    /** A nested pattern or signal expression, e.g. `sine.range(200, 800).slow(4)`. */
    | { kind: "pattern"; chain: StrudelChain }
    | { kind: "function"; text: string }
    | { kind: "other"; text: string }
  )

export interface StrudelCall extends Range {
  name: string
  nameRange: Range
  args: StrudelArg[]
  /** Between the parentheses (empty for a property access such as `.p1`). */
  argsRange: Range
  /** `.name(args)` including the dot: delete it to remove the method from its chain. */
  methodRange: Range
}

export interface StrudelChain extends Range {
  /** The call or identifier the chain starts from (`s("bd")`, `sine`, `"c e"`). */
  head: StrudelCall | (Range & { name: string; literal?: StrudelArg })
  methods: StrudelCall[]
}

export type TrackKind = "drums" | "melodic" | "other"

export interface StrudelTrack extends Range {
  index: number
  /** The `$:`/`name:` label, if the track has one (`$` labels count as unnamed). */
  label: string | null
  /** A `_$:` label: Strudel's own mute. */
  muted: boolean
  chain: StrudelChain
  kind: TrackKind
  /** The first sound it plays (`s`/`sound`), e.g. "sawtooth" or "bd". */
  sound: string | null
}

export interface StrudelTempo {
  /** Cycles per second. */
  cps: number
  unit: "cps" | "cpm"
  call: StrudelCall
}

export interface StrudelSong {
  code: string
  tempo: StrudelTempo | null
  tracks: StrudelTrack[]
  /** How the tracks are written: `$:` labels, args of one `stack(...)`, or one pattern. */
  layout: "labels" | "stack" | "single" | "empty"
  /** Methods applied to the whole `stack(...)`, e.g. `.postgain(.8)`. */
  master: StrudelCall[]
  masterChain: StrudelChain | null
  /** Every mini-notation string in the program, in source order. */
  minis: Extract<StrudelArg, { kind: "mini" }>[]
  /** The ESTree program from acorn, for tools that need the raw JavaScript tree. */
  program: AcornNode
}

export class StrudelSyntaxError extends Error {
  constructor(message: string, readonly offset: number) {
    super(message)
    this.name = "StrudelSyntaxError"
  }
}

const SYNTHS = new Set(["sine", "triangle", "square", "sawtooth", "saw", "tri", "sin", "sqr", "white", "pink", "brown", "supersaw", "pulse", "noise"])
const TEMPO = new Set(["setcps", "setCps", "setcpm", "setCpm"])
const SETUP = new Set(["samples", "soundfont", "loadSoundfont", "initHydra", "aliasBank", "registerSound"])
const MELODIC_HEADS = new Set(["note", "n", "freq", "chord", "voicing", "arp"])

/** Parse Strudel code. Throws `StrudelSyntaxError` when the JavaScript doesn't parse. */
export function parseStrudel(code: string): StrudelSong {
  let program: EsNode
  try {
    program = parseJs(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowAwaitOutsideFunction: true,
      allowReturnOutsideFunction: true,
    }) as unknown as EsNode
  } catch (err) {
    const e = err as { message?: string; pos?: number }
    throw new StrudelSyntaxError(e.message ?? String(err), e.pos ?? 0)
  }

  const text = (n: Range) => code.slice(n.start, n.end)
  // Keyed by offset: stack arguments are read once as arguments and again as tracks.
  const minis = new Map<number, Extract<StrudelArg, { kind: "mini" }>>()

  // Constant arithmetic (`120/4`, `-.5`, `(1+2)*3`) counts as a number.
  function constant(node: EsNode): number | null {
    if (node.type === "Literal" && typeof node.value === "number") return node.value
    if (node.type === "UnaryExpression" && (node.operator === "-" || node.operator === "+")) {
      const v = constant(node.argument as EsNode)
      return v === null ? null : node.operator === "-" ? -v : v
    }
    if (node.type === "BinaryExpression") {
      const a = constant(node.left as EsNode)
      const b = constant(node.right as EsNode)
      if (a === null || b === null) return null
      switch (node.operator) {
        case "+": return a + b
        case "-": return a - b
        case "*": return a * b
        case "/": return a / b
        case "%": return a % b
        case "**": return a ** b
      }
    }
    return null
  }

  function arg(node: EsNode): StrudelArg {
    const range = { start: node.start, end: node.end }
    const value = constant(node)
    if (value !== null) return { kind: "number", value, ...range }
    const raw = node.type === "Literal" && typeof node.value === "string" ? String(node.raw) : null
    const template = node.type === "TemplateLiteral" && !(node.expressions as EsNode[]).length
    if ((raw && raw.startsWith('"')) || template) {
      const source = raw ? (node.value as string) : String(((node.quasis as EsNode[])[0]!.value as { cooked: string }).cooked)
      // Offsets are into the raw literal; escapes would shift them, so only plain strings map 1:1.
      let mini: MiniGroup | null = null
      let error: MiniSyntaxError | null = null
      try {
        mini = parseMini(source)
      } catch (err) {
        if (err instanceof MiniSyntaxError) error = err
        else throw err
      }
      const out = { kind: "mini" as const, source, contentStart: node.start + 1, mini, error, ...range }
      minis.set(node.start, out)
      return out
    }
    if (raw) return { kind: "string", value: node.value as string, ...range }
    if (node.type === "ArrowFunctionExpression" || node.type === "FunctionExpression") return { kind: "function", text: text(node), ...range }
    const c = chain(node)
    if (c) return { kind: "pattern", chain: c, ...range }
    return { kind: "other", text: text(node), ...range }
  }

  function call(node: EsNode, name: string, nameNode: EsNode, receiverEnd: number): StrudelCall {
    const args = (node.arguments as EsNode[]).map(arg)
    // The text between the parentheses: from just after "(" to just before ")".
    const open = code.indexOf("(", nameNode.end)
    return {
      name,
      nameRange: { start: nameNode.start, end: nameNode.end },
      args,
      argsRange: { start: open + 1, end: node.end - 1 },
      methodRange: { start: receiverEnd, end: node.end },
      start: node.start,
      end: node.end,
    }
  }

  // Flatten `a(x).b(y).c` into a head and its methods.
  function chain(node: EsNode): StrudelChain | null {
    const methods: StrudelCall[] = []
    let cur = node
    for (;;) {
      if (cur.type === "CallExpression") {
        const callee = cur.callee as EsNode
        if (callee.type === "MemberExpression" && !callee.computed && (callee.property as EsNode).type === "Identifier") {
          const object = callee.object as EsNode
          const property = callee.property as EsNode
          methods.unshift(call(cur, property.name as string, property, object.end))
          cur = object
          continue
        }
        if (callee.type === "Identifier") {
          return { head: call(cur, callee.name as string, callee, cur.start), methods, start: node.start, end: node.end }
        }
        return null
      }
      if (cur.type === "MemberExpression" && !cur.computed && (cur.property as EsNode).type === "Identifier") {
        // A getter in the chain, e.g. `.p1` — a method with no arguments or parentheses.
        const object = cur.object as EsNode
        const property = cur.property as EsNode
        methods.unshift({
          name: property.name as string,
          nameRange: { start: property.start, end: property.end },
          args: [],
          argsRange: { start: cur.end, end: cur.end },
          methodRange: { start: object.end, end: cur.end },
          start: cur.start,
          end: cur.end,
        })
        cur = object
        continue
      }
      if (cur.type === "Identifier") return { head: { name: cur.name as string, start: cur.start, end: cur.end }, methods, start: node.start, end: node.end }
      if ((cur.type === "Literal" && typeof cur.value === "string") || cur.type === "TemplateLiteral") {
        return { head: { name: "", literal: arg(cur), start: cur.start, end: cur.end }, methods, start: node.start, end: node.end }
      }
      return null
    }
  }

  const calls = (c: StrudelChain): StrudelCall[] => ("args" in c.head ? [c.head, ...c.methods] : c.methods)

  function soundOf(c: StrudelChain): string | null {
    for (const k of calls(c)) {
      if (k.name !== "s" && k.name !== "sound") continue
      const first = k.args[0]
      if (first?.kind === "mini" && first.mini) {
        const atom = miniAtoms(first.mini, { ops: false }).find((a) => !a.rest)
        if (atom) return atom.value.split(":")[0]!
      }
      if (first?.kind === "string") return first.value
    }
    return null
  }

  function kindOf(c: StrudelChain, sound: string | null): TrackKind {
    const names = calls(c).map((k) => k.name)
    if (names.some((n) => MELODIC_HEADS.has(n)) || names.includes("scale") || (sound && SYNTHS.has(sound))) return "melodic"
    if (sound) return "drums"
    return "other"
  }

  function track(node: EsNode, index: number, label: string | null): StrudelTrack | null {
    const c = chain(node)
    if (!c) return null
    const sound = soundOf(c)
    const muted = label !== null && label.startsWith("_")
    const name = label === null ? null : label.replace(/^_/, "")
    return {
      index,
      label: name === "$" || name === "" ? null : name,
      muted,
      chain: c,
      kind: kindOf(c, sound),
      sound,
      start: node.start,
      end: node.end,
    }
  }

  let tempo: StrudelTempo | null = null
  const labelled: StrudelTrack[] = []
  let root: EsNode | null = null
  const unwrap = (n: EsNode) => (n.type === "AwaitExpression" ? (n.argument as EsNode) : n)

  for (const statement of program.body as EsNode[]) {
    if (statement.type === "LabeledStatement") {
      const body = statement.body as EsNode
      if (body.type === "ExpressionStatement") {
        const t = track(body.expression as EsNode, labelled.length, (statement.label as EsNode).name as string)
        if (t) labelled.push(t)
      }
      continue
    }
    if (statement.type !== "ExpressionStatement") continue
    const expr = unwrap(statement.expression as EsNode)
    const callee = expr.type === "CallExpression" ? (expr.callee as EsNode) : null
    const name = callee?.type === "Identifier" ? (callee.name as string) : null
    if (name && TEMPO.has(name)) {
      const k = call(expr, name, callee!, expr.start)
      const value = k.args[0]?.kind === "number" ? k.args[0].value : NaN
      const unit = name.toLowerCase() === "setcpm" ? "cpm" : "cps"
      tempo = { cps: unit === "cpm" ? value / 60 : value, unit, call: k }
      continue
    }
    if (name && SETUP.has(name)) continue
    root = expr
  }

  let tracks: StrudelTrack[] = labelled
  let layout: StrudelSong["layout"] = labelled.length ? "labels" : "empty"
  let master: StrudelCall[] = []
  let masterChain: StrudelChain | null = null
  if (!labelled.length && root) {
    const c = chain(root)
    if (c && "args" in c.head && c.head.name === "stack") {
      layout = "stack"
      master = c.methods
      masterChain = c
      tracks = (c.head.args as StrudelArg[])
        .map((a, i) => (a.kind === "pattern" || a.kind === "mini" ? track(nodeAt(program, a.start, a.end)!, i, null) : null))
        .filter((t): t is StrudelTrack => !!t)
    } else if (c) {
      layout = "single"
      tracks = [track(root, 0, null)!]
    }
  }

  return {
    code,
    tempo,
    tracks,
    layout,
    master,
    masterChain,
    minis: [...minis.values()].sort((a, b) => a.start - b.start),
    program: program as unknown as AcornNode,
  }
}

// The ESTree node spanning exactly [start, end) (to re-read a stack argument as a track).
function nodeAt(root: EsNode, start: number, end: number): EsNode | null {
  let found: EsNode | null = null
  const visit = (n: unknown) => {
    if (found || !n || typeof n !== "object") return
    if (Array.isArray(n)) return n.forEach(visit)
    const node = n as EsNode
    if (typeof node.type === "string" && node.start === start && node.end === end) {
      found = node
      return
    }
    if (typeof node.start === "number" && (node.start > start || node.end < end)) return
    for (const key of Object.keys(node)) if (key !== "type") visit(node[key])
  }
  visit(root)
  return found
}

/** All calls in a chain, head first. */
export function chainCalls(chain: StrudelChain): StrudelCall[] {
  return "args" in chain.head ? [chain.head, ...chain.methods] : chain.methods
}

/** The last call named `name` in the chain (later calls win in Strudel). */
export function findCall(chain: StrudelChain, name: string): StrudelCall | null {
  const all = chainCalls(chain)
  for (let i = all.length - 1; i >= 0; i--) if (all[i]!.name === name) return all[i]!
  return null
}
