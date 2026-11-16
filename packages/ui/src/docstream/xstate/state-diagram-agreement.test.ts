/* The xstate fence (Pele, from xstateToMermaid) and the kit's StateDiagram (Diagram + ELK, from machineToDraft) draw the
   same machine two ways. What each says about it must be the same: a state's second line, and every edge's label. */
import { createMachine } from "xstate"
import { describe, expect, it } from "vitest"
import { machineToDraft, type MachineLike } from "../../lib/state-diagram-model"
import { parseXState, xstateToMermaid } from "./machine"

const SOURCE = `import { createMachine, fromPromise } from "xstate"
export const upload = createMachine({
  id: "upload",
  initial: "idle",
  states: {
    idle: { on: { PICK: { target: "uploading", guard: "hasFile" } } },
    uploading: {
      invoke: { src: "putObject", onDone: "checking", onError: "failed" },
      after: { 30000: "failed" },
    },
    checking: { invoke: { src: fromPromise(async () => check()), onDone: "done", onError: "failed" } },
    failed: { on: { RETRY: "uploading" }, always: { target: "idle", guard: "gaveUp" } },
    done: { type: "final" },
  },
})`

const unescape = (text: string) => text.replace(/<br\/>/g, "\n").replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n))).replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&")

function fromMermaid(code: string) {
  const text = xstateToMermaid(code)
  const names = new Map<string, string>()
  const details = new Map<string, string>()
  for (const [, label, alias] of text.matchAll(/state "([^"]*)" as (s\d+)/g)) {
    const [name, detail] = unescape(label!).split("\n")
    names.set(alias!, name!)
    if (detail) details.set(name!, detail)
  }
  const edges = [...text.matchAll(/^ {2}(s\d+) --> (s\d+): (.*)$/gm)].map(([, from, to, label]) => `${names.get(from!)} -> ${names.get(to!)}: ${unescape(label!)}`)
  return { details, edges: edges.sort() }
}

function fromStateDiagram(code: string) {
  const machine = createMachine(parseXState(code) as never) as unknown as MachineLike
  const draft = machineToDraft(machine)
  const key = new Map(draft.nodes.map((n) => [n.id, n.data?.key ?? ""]))
  const details = new Map(draft.nodes.filter((n) => n.kind !== "root" && n.detail).map((n) => [n.data!.key, n.detail!]))
  const edges = (draft.edges ?? []).filter((e) => e.kind !== "initial").map((e) => `${key.get(e.from)} -> ${key.get(e.to)}: ${e.label}`)
  return { details, edges: edges.sort() }
}

describe("the xstate fence and StateDiagram", () => {
  it("say the same about a machine that invokes: what's invoked, and every edge", () => {
    const fence = fromMermaid(SOURCE)
    const kit = fromStateDiagram(SOURCE)
    expect(fence.details).toEqual(kit.details)
    expect(fence.details.get("uploading")).toBe("invoke putObject")
    // An actor written inline has no name to show on either.
    expect(fence.details.get("checking")).toBe("invoke actor")
    expect(fence.edges).toEqual(kit.edges)
    expect(fence.edges).toEqual(expect.arrayContaining([
      "uploading -> checking: done", "uploading -> failed: error", "uploading -> failed: after 30000",
      "idle -> uploading: PICK [hasFile]", "failed -> idle: always [gaveUp]",
    ]))
  })
})
