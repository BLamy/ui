import { parse, parseExpression } from "@babel/parser"
import { createMachine, type AnyStateNode } from "xstate"

type Syntax = { type: string; [key: string]: unknown }
const syntax = (value: unknown): value is Syntax => !!value && typeof value === "object" && "type" in value
const ignored = new Set(["actions", "entry", "exit", "context", "invoke", "guard", "cond", "types", "input", "output", "meta", "tags", "description", "params"])

/** Read declarative data, never evaluate machine code, imports, actions or guards. */
export function parseXState(code: string): Record<string, unknown> {
  const bindings = new Map<string, Syntax>()
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
        if (!container && (key === "guard" || key === "cond")) {
          const guard = prop.value as Syntax
          result.guard = guard.type === "StringLiteral" ? guard.value : guard.type === "Identifier" ? guard.name : "guard"
        } else if (container || !ignored.has(key)) result[key] = read(prop.value as Syntax, seen, !container && ["states", "on", "after"].includes(key))
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

const label = (text: string) => text.replace(/[&<>"\n\r:{}]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\n": " ", "\r": " ", ":": "&#58;", "{": "&#123;", "}": "&#125;" })[c]!)

/** XState resolves relative, nested and #id targets; Pele draws the resulting statechart. */
export function xstateToMermaid(code: string): string {
  const machine = createMachine(parseXState(code))
  const aliases = new Map<AnyStateNode, string>()
  function index(node: AnyStateNode) {
    aliases.set(node, `s${aliases.size}`)
    Object.values(node.states).forEach(index)
  }
  index(machine.root)
  const lines = ["stateDiagram-v2", `  state "${label(machine.id)}" as s0 {`]
  function emit(node: AnyStateNode, indent: string) {
    const children = Object.values(node.states)
    for (const [position, child] of children.entries()) {
      const id = aliases.get(child)!
      lines.push(`${indent}state "${label(child.key)}" as ${id}`)
      if (Object.keys(child.states).length) {
        lines.push(`${indent}state ${id} {`)
        emit(child, `${indent}  `)
        lines.push(`${indent}}`)
      } else emit(child, indent)
      if (child.type === "final") lines.push(`${indent}${id} --> [*]`)
      if (node.type === "parallel" && position < children.length - 1) lines.push(`${indent}--`)
    }
    for (const target of node.initial?.target ?? []) lines.push(`${indent}[*] --> ${aliases.get(target)}`)
    for (const child of [node]) {
      for (const [event, transitions] of child.transitions) {
        for (const transition of transitions) {
          const eventLabel = event.startsWith("xstate.after.") ? `after ${event.split(".")[2]}` : event.startsWith("xstate.done.state.") ? "done" : event
          const guard = typeof transition.guard === "string" ? transition.guard : transition.guard ? "guard" : ""
          for (const target of transition.target ?? [child]) lines.push(`${indent}${aliases.get(child)} --> ${aliases.get(target)}: ${label(eventLabel + (guard ? ` [${guard}]` : ""))}`)
        }
      }
      for (const transition of child.always ?? []) for (const target of transition.target ?? [child]) lines.push(`${indent}${aliases.get(child)} --> ${aliases.get(target)}: always`)
    }
  }
  emit(machine.root, "    ")
  lines.push("  }")
  return lines.join("\n")
}
