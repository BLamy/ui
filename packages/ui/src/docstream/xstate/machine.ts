import { createMachine } from "xstate"
import { machineToDraft, transitionNotation, type StateMachineLike, type StateNodeData } from "@brett_lamy/ui/lib/state-diagram-model"
import { parseXState } from "@brett_lamy/ui/lib/state-diagram-source"

/* The xstate fence's machine as text: the source read by the library's `parseXState` (`@brett_lamy/ui/lib/state-diagram-source`,
   which never runs machine code), made into a machine by XState, which resolves relative, nested and #id targets, and
   written from the library's `machineToDraft`: the same states and transitions a StateDiagram draws, as a Mermaid
   statechart in UML's notation (`entry / onPlay` in a state, `event [guard] / action` on a transition). The fence draws a
   StateDiagram; this is its text form, and what it shows where the library's diagram can't load. */

const escape = (text: string) => text.replace(/[&<>"\n\r:{}]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\n": " ", "\r": " ", ":": "&#58;", "{": "&#123;", "}": "&#125;" })[c]!)

/** What a state says under its name, a line each: what it is if its name doesn't say, and what it does. */
function stateLines(data: StateNodeData | undefined): string[] {
  if (!data) return []
  const names = (list: StateNodeData["entry"]) => list.map((a) => a.name).join(", ")
  return [
    data.type === "parallel" ? "parallel" : "",
    data.type === "history" ? (data.history === "deep" ? "deep history" : "history") : "",
    data.entry.length ? `entry / ${names(data.entry)}` : "",
    data.exit.length ? `exit / ${names(data.exit)}` : "",
    data.invoke.length ? `invoke ${data.invoke.map((i) => i.src).join(", ")}` : "",
    data.tags.length ? `tags ${data.tags.join(", ")}` : "",
  ].filter(Boolean)
}

/** A machine's source as a Mermaid statechart: each state, with on the lines under its name what it is if its name doesn't
 *  say (`parallel`, `history`) and what it does (`entry / …`, `exit / …`, `invoke …`), and each way out, written
 *  `event [guard] / action`. */
export function xstateToMermaid(code: string): string {
  const machine = createMachine(parseXState(code)) as unknown as StateMachineLike
  const { nodes, edges } = machineToDraft(machine)
  const alias = new Map(nodes.map((n, i) => [n.id, `s${i}`]))
  const kids = new Map<string | null, typeof nodes>()
  for (const n of nodes) kids.set(n.parent ?? null, [...(kids.get(n.parent ?? null) ?? []), n])
  const stateLabel = (n: (typeof nodes)[number]) => [n.title ?? "", ...stateLines(n.data)].map(escape).join("<br/>")
  const root = nodes.find((n) => !n.parent)!
  const lines = ["stateDiagram-v2", `  state "${stateLabel(root)}" as s0 {`]
  const emit = (node: (typeof nodes)[number], indent: string) => {
    const children = kids.get(node.id) ?? []
    for (const [position, child] of children.entries()) {
      const id = alias.get(child.id)!
      lines.push(`${indent}state "${stateLabel(child)}" as ${id}`)
      if (kids.get(child.id)?.length) {
        lines.push(`${indent}state ${id} {`)
        emit(child, `${indent}  `)
        lines.push(`${indent}}`)
      }
      if (child.data?.type === "final") lines.push(`${indent}${id} --> [*]`)
      if (node.data?.type === "parallel" && position < children.length - 1) lines.push(`${indent}--`)
    }
    for (const child of children) if (child.entry) lines.push(`${indent}[*] --> ${alias.get(child.id)}`)
  }
  emit(root, "    ")
  lines.push("  }")
  // A state named inside a block is taken to be in that block, whichever block named it last, so an edge written in one moves
  // what it goes to, and one written in its own state's block takes that state out of its parent. Out here, an edge moves nothing.
  for (const e of edges) lines.push(`  ${alias.get(e.from)} --> ${alias.get(e.to)}: ${escape(transitionNotation(e.data))}`)
  return lines.join("\n")
}
