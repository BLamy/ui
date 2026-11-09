import { parse, parseExpression } from "@babel/parser"
import { createMachine, type AnyStateNode } from "xstate"

type Syntax = { type: string; [key: string]: unknown }
const syntax = (value: unknown): value is Syntax => !!value && typeof value === "object" && "type" in value
const ignored = new Set(["actions", "entry", "exit", "context", "guard", "cond", "types", "input", "output", "meta", "tags", "description", "params"])

const WRAPPERS = ["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "ParenthesizedExpression"]
const unwrap = (node: Syntax): Syntax => (WRAPPERS.includes(node.type) ? unwrap(node.expression as Syntax) : node)

/** What a guard's called, without running it: its name, or what's being called, like `not` or `and`. */
function guardName(node: Syntax): string {
  const guard = unwrap(node)
  if (guard.type === "StringLiteral") return String(guard.value)
  if (guard.type === "Identifier") return String(guard.name)
  if (guard.type === "CallExpression") return calleeName(guard) ?? "guard"
  if (guard.type === "ObjectExpression") {
    const named = (guard.properties as Syntax[]).find((p) => p.type === "ObjectProperty" && !p.computed && String((p.key as Syntax).name ?? (p.key as Syntax).value) === "type")
    if (named && unwrap(named.value as Syntax).type === "StringLiteral") return String(unwrap(named.value as Syntax).value)
  }
  return "guard"
}

const calleeName = (call: Syntax): string | null => {
  const callee = call.callee as Syntax
  return callee.type === "Identifier" ? String(callee.name) : callee.type === "MemberExpression" ? String((callee.property as Syntax).name ?? "") || null : null
}

/** What an invoked actor's called, without running it. Written inline, it has no name to show, so it's called `actor`, as it is on a StateDiagram. */
function actorName(node: Syntax): string {
  const src = unwrap(node)
  if (src.type === "StringLiteral") return String(src.value)
  if (src.type === "Identifier") return String(src.name)
  if (src.type === "MemberExpression" && !src.computed) return String((src.property as Syntax).name)
  if (src.type === "FunctionExpression" && syntax(src.id)) return String(src.id.name)
  return "actor"
}

/** Read declarative data, never evaluate machine code, imports, actions or guards. */
export function parseXState(code: string): Record<string, unknown> {
  const bindings = new Map<string, Syntax>()
  /** An `invoke`: its name and where it goes when it finishes. What it does and what it's given are code. */
  function readInvoke(node: Syntax, seen: Set<string>): unknown {
    const value = unwrap(node)
    if (value.type === "Identifier" && bindings.has(String(value.name)) && !seen.has(String(value.name))) {
      return readInvoke(bindings.get(String(value.name))!, new Set([...seen, String(value.name)]))
    }
    if (value.type === "ArrayExpression") return (value.elements as Syntax[]).map((n) => readInvoke(n, seen))
    if (value.type !== "ObjectExpression") throw new Error("XState diagrams need a static machine config. Use literal states, initial states and transition targets.")
    const result: Record<string, unknown> = Object.create(null)
    for (const prop of value.properties as Syntax[]) {
      if (prop.type !== "ObjectProperty" || prop.computed) throw new Error("Use literal properties in XState diagram configs; spreads and computed keys are not supported.")
      const keyNode = prop.key as Syntax
      const key = String(keyNode.name ?? keyNode.value)
      if (key === "src") result.src = actorName(prop.value as Syntax)
      else if (key === "id" && unwrap(prop.value as Syntax).type === "StringLiteral") result.id = unwrap(prop.value as Syntax).value
      else if (key === "onDone" || key === "onError" || key === "onSnapshot") result[key] = read(prop.value as Syntax, seen)
    }
    return result
  }
  function read(node: Syntax, seen = new Set<string>(), container = false): unknown {
    if (["TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression", "ParenthesizedExpression"].includes(node.type)) return read(node.expression as Syntax, seen, container)
    if (["StringLiteral", "NumericLiteral", "BooleanLiteral", "NullLiteral"].includes(node.type)) return node.value ?? null
    if (node.type === "ArrayExpression") return (node.elements as Syntax[]).map((n) => read(n, seen))
    if (node.type === "Identifier" && bindings.has(String(node.name)) && !seen.has(String(node.name))) {
      return read(bindings.get(String(node.name))!, new Set([...seen, String(node.name)]), container)
    }
    if (node.type === "ObjectExpression") {
      const result: Record<string, unknown> = Object.create(null)
      for (const prop of node.properties as Syntax[]) {
        if (prop.type !== "ObjectProperty" || prop.computed) throw new Error("Use literal properties in XState diagram configs; spreads and computed keys are not supported.")
        const keyNode = prop.key as Syntax
        const key = String(keyNode.name ?? keyNode.value)
        if (!container && (key === "guard" || key === "cond")) result.guard = guardName(prop.value as Syntax)
        else if (!container && key === "invoke") result.invoke = readInvoke(prop.value as Syntax, seen)
        else if (container || !ignored.has(key)) result[key] = read(prop.value as Syntax, seen, !container && ["states", "on", "after"].includes(key))
      }
      return result
    }
    throw new Error("XState diagrams need a static machine config. Use literal states, initial states and transition targets.")
  }
  const options = { plugins: ["typescript" as const] }
  let expression: Syntax | undefined
  try { expression = parseExpression(code.trim(), options) as unknown as Syntax } catch { /* A module or JSON document follows. */ }
  if (!expression || expression.type !== "ObjectExpression") {
    let program: ReturnType<typeof parse>
    try { program = parse(code, { ...options, sourceType: "module" }) }
    catch {
      // JSON's quoted object keys aren't a JavaScript block.
      return validate(JSON.parse(code))
    }
    const calls: Syntax[] = []
    function walk(value: unknown) {
      if (Array.isArray(value)) { value.forEach(walk); return }
      if (!syntax(value)) return
      if (value.type === "VariableDeclarator" && syntax(value.id) && value.id.type === "Identifier" && syntax(value.init)) bindings.set(String(value.id.name), value.init)
      if (value.type === "CallExpression") {
        const callee = value.callee as Syntax
        if (callee?.name === "createMachine" || callee?.name === "Machine" || (callee?.property as Syntax)?.name === "createMachine") calls.push(value)
      }
      Object.values(value).forEach(walk)
    }
    walk(program)
    if (calls.length !== 1) throw new Error("Use one createMachine({...}) call or a machine config object in each xstate fence.")
    expression = (calls[0].arguments as Syntax[])[0]
  }
  if (!expression) throw new Error("Add an XState machine config.")
  return validate(read(expression))
}

function validate(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("states" in value) || !value.states || typeof value.states !== "object" || Array.isArray(value.states) || !Object.keys(value.states).length) throw new Error("An XState diagram needs a non-empty states object.")
  return value as Record<string, unknown>
}

/** What an event's called on an edge, the same as on a StateDiagram. */
function eventName(event: string): string {
  if (event.startsWith("xstate.after.")) return `after ${event.split(".")[2]}`
  if (event.startsWith("xstate.done.actor.") || event.startsWith("xstate.done.state.")) return "done"
  if (event.startsWith("xstate.error.actor.")) return "error"
  if (event.startsWith("xstate.snapshot.")) return "snapshot"
  return event
}

const guardOf = (guard: unknown): string => (typeof guard === "string" ? guard : guard ? "guard" : "")

/** One with no name gets one from XState, which isn't anything to show. */
const invokedName = (src: unknown) => (typeof src === "string" && !src.startsWith("xstate.invoke.") ? src : "actor")

const label = (text: string) => text.replace(/[&<>"\n\r:{}]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\n": " ", "\r": " ", ":": "&#58;", "{": "&#123;", "}": "&#125;" })[c]!)

/** A state's name, and on a second line what it is, if that's something the name doesn't say. */
function stateLabel(node: AnyStateNode): string {
  const invoked = node.invoke.map((inv) => invokedName(inv.src))
  const detail = node.type === "parallel" ? "parallel"
    : node.type === "history" ? (node.history === "deep" ? "deep history" : "history")
    : invoked.length ? `invoke ${invoked.join(", ")}` : ""
  return label(node.key) + (detail ? `<br/>${label(detail)}` : "")
}

/** XState resolves relative, nested and #id targets; Pele draws the resulting statechart. */
export function xstateToMermaid(code: string): string {
  const machine = createMachine(parseXState(code))
  const aliases = new Map<AnyStateNode, string>()
  function index(node: AnyStateNode) {
    aliases.set(node, `s${aliases.size}`)
    Object.values(node.states).forEach(index)
  }
  index(machine.root)
  const lines = ["stateDiagram-v2", `  state "${stateLabel(machine.root)}" as s0 {`]
  function emit(node: AnyStateNode, indent: string) {
    const children = Object.values(node.states)
    for (const [position, child] of children.entries()) {
      const id = aliases.get(child)!
      lines.push(`${indent}state "${stateLabel(child)}" as ${id}`)
      if (Object.keys(child.states).length) {
        lines.push(`${indent}state ${id} {`)
        emit(child, `${indent}  `)
        lines.push(`${indent}}`)
      }
      if (child.type === "final") lines.push(`${indent}${id} --> [*]`)
      if (node.type === "parallel" && position < children.length - 1) lines.push(`${indent}--`)
    }
    for (const target of node.initial?.target ?? []) lines.push(`${indent}[*] --> ${aliases.get(target)}`)
  }
  emit(machine.root, "    ")
  lines.push("  }")
  // A state named inside a block is taken to be in that block, whichever block named it last, so an edge written in one moves
  // what it goes to, and one written in its own state's block takes that state out of its parent. Out here, an edge moves nothing.
  const edge = (from: AnyStateNode, to: AnyStateNode, text: string) => lines.push(`  ${aliases.get(from)} --> ${aliases.get(to)}: ${label(text)}`)
  for (const node of aliases.keys()) {
    for (const [event, transitions] of node.transitions) {
      for (const transition of transitions) {
        const guard = guardOf(transition.guard)
        for (const target of transition.target ?? [node]) edge(node, target, eventName(event) + (guard ? ` [${guard}]` : ""))
      }
    }
    for (const transition of node.always ?? []) {
      const guard = guardOf(transition.guard)
      for (const target of transition.target ?? [node]) edge(node, target, `always${guard ? ` [${guard}]` : ""}`)
    }
  }
  return lines.join("\n")
}
