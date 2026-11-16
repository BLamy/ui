import { createMachine } from "xstate"
import { machineToDraft, type StateMachineLike } from "@brett_lamy/ui/lib/state-diagram-model"
import { parseXState } from "@brett_lamy/ui/lib/state-diagram-source"

/* The xstate fence's machine: the source read by the library's `parseXState` (`@brett_lamy/ui/lib/state-diagram-source`,
   which never runs machine code), made into a machine by XState, which resolves relative, nested and #id targets, and
   drawn from the library's `machineToDraft`: the same nodes, edges and labels as a StateDiagram, written out as a
   statechart for Pele. */

const escape = (text: string) => text.replace(/[&<>"\n\r:{}]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "\n": " ", "\r": " ", ":": "&#58;", "{": "&#123;", "}": "&#125;" })[c]!)

/** A machine's source as a Mermaid statechart: each state, with on a second line what it is if its name doesn't say
 *  (`parallel`, `history`, what it invokes), and each way out, labelled as a StateDiagram labels it. */
export function xstateToMermaid(code: string): string {
  const machine = createMachine(parseXState(code)) as unknown as StateMachineLike
  const { nodes, edges } = machineToDraft(machine)
  const states = nodes.filter((n) => n.data?.type !== "initial")
  const alias = new Map(states.map((n, i) => [n.id, `s${i}`]))
  const kids = new Map<string | null, typeof states>()
  for (const n of states) kids.set(n.parent ?? null, [...(kids.get(n.parent ?? null) ?? []), n])
  const markers = new Map(nodes.filter((n) => n.data?.type === "initial").map((n) => [n.id, n.parent!]))
  const starts = new Map<string, string[]>()
  for (const e of edges) {
    const parent = markers.get(e.from)
    if (parent) starts.set(parent, [...(starts.get(parent) ?? []), e.to])
  }
  const stateLabel = (n: (typeof states)[number]) => escape(n.label ?? "") + (n.detail ? `<br/>${escape(n.detail)}` : "")
  const root = states.find((n) => !n.parent)!
  const lines = ["stateDiagram-v2", `  state "${stateLabel(root)}" as s0 {`]
  const emit = (node: (typeof states)[number], indent: string) => {
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
    for (const target of starts.get(node.id) ?? []) lines.push(`${indent}[*] --> ${alias.get(target)}`)
  }
  emit(root, "    ")
  lines.push("  }")
  // A state named inside a block is taken to be in that block, whichever block named it last, so an edge written in one moves
  // what it goes to, and one written in its own state's block takes that state out of its parent. Out here, an edge moves nothing.
  for (const e of edges) {
    if (markers.has(e.from)) continue
    lines.push(`  ${alias.get(e.from)} --> ${alias.get(e.to)}: ${escape(e.label ?? "")}`)
  }
  return lines.join("\n")
}
