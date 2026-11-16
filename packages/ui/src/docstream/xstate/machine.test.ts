import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { createMachine, type AnyStateNode } from "xstate"
import { parseXState } from "@brett_lamy/ui/lib/state-diagram-source"
import { xstateToMermaid } from "./machine"
import { render } from "pele"

const toggle = { id: "toggle", initial: "off", states: { off: { on: { TOGGLE: "on" } }, on: { on: { TOGGLE: "off" } } } }

describe("XState diagrams", () => {
  it("accepts JSON and TypeScript createMachine source without running user code", () => {
    expect(parseXState(JSON.stringify(toggle))).toEqual(toggle)
    const code = `import { setup } from "xstate";
      const config = { initial: "off", context: globalThis.mustNeverRun(), states: {
        off: { entry: () => globalThis.mustNeverRun(), on: { TOGGLE: "on" } }, on: {} }
      } as const;
      export const machine = setup({ types: {} as { context: { count: number } } }).createMachine(config);`
    expect(xstateToMermaid(code)).toContain("s1 --> s2: TOGGLE")
  })

  it("resolves nested and absolute targets, initial and final states, delays and eventless transitions", () => {
    const diagram = xstateToMermaid(JSON.stringify({ id: "flow", initial: "active", states: {
      active: { initial: "waiting", states: { waiting: { after: { 1000: "ready" } }, ready: { always: "#done" } } },
      done: { id: "done", type: "final" },
    } }))
    expect(diagram).toContain("after 1000")
    expect(diagram).toContain("always")
    expect(diagram).toContain("[*] --> s1")
    expect(diagram).toContain("s4 --> [*]")
    expect(render(diagram).svg).toContain("waiting")
  })

  it("keeps state and event names that also happen to be config keys", () => {
    const diagram = xstateToMermaid(`({ initial: "context", states: { context: { on: { actions: "entry" } }, entry: {} } })`)
    expect(diagram).toContain('state "context"')
    expect(diagram).toContain(": actions")
  })

  it("draws global transitions, named guards and parallel regions", () => {
    const diagram = xstateToMermaid(`createMachine({ id: 'parallel', type: 'parallel', on: { RESET: { target: '.first', guard: 'canReset' } }, states: {
      first: { initial: 'off', states: { off: { on: { TOGGLE: 'on' } }, on: {} } },
      second: { initial: 'idle', states: { idle: {} } }
    } })`)
    expect(diagram).toContain('RESET [canReset]')
    expect(diagram).toContain('--\n')
    expect(render(diagram).svg).toContain('TOGGLE')
  })

  it("rejects dynamic structural expressions, invalid targets and unfinished input", () => {
    expect(() => xstateToMermaid(`createMachine({ states: getStates() })`)).toThrow(/static machine config/)
    expect(() => xstateToMermaid(`{ initial: "missing", states: { idle: {} } }`)).toThrow()
    expect(() => xstateToMermaid("{}")).toThrow(/states/)
    expect(() => xstateToMermaid("createMachine({")).toThrow()
  })

  it("escapes source text before including it in diagram markup", () => {
    const diagram = xstateToMermaid(JSON.stringify({ initial: '<script>alert(1)</script>', states: { '<script>alert(1)</script>': {} } }))
    expect(diagram).not.toContain("<script>")
    expect(render(diagram).svg).not.toContain("<script>")
  })

  describe("invoke", () => {
    const spike = readFileSync(join(__dirname, "__fixtures__/upload-machine.txt"), "utf8")
    /** What's drawn, as `from --> to: label`, by name. */
    const drawn = (code: string) => {
      const diagram = xstateToMermaid(code)
      const names = new Map([...diagram.matchAll(/state "([^"]*)" as (s\d+)/g)].map((m) => [m[2], m[1].replace(/<br\/>.*/, "")]))
      return [...diagram.matchAll(/(s\d+) --> (s\d+): (.*)/g)].map((m) => `${names.get(m[1])} --> ${names.get(m[2])}: ${m[3]}`)
    }

    it("draws all 36 edges of the spike's machine, with the 14 from what it invokes", () => {
      const edges = drawn(spike)
      expect(edges).toHaveLength(36)
      expect(edges.filter((e) => e.endsWith(": done") || e.includes(": done ["))).toHaveLength(9)
      expect(edges.filter((e) => e.endsWith(": error") || e.includes(": error ["))).toHaveLength(7)
      expect(edges).toContain("authenticating --> checkingQuota: done")
      expect(edges).toContain("authenticating --> rejected: error")
      expect(edges).toContain("committing --> backingOff: error")
      expect(edges.filter((e) => e.includes("always"))).toHaveLength(7)
      expect(edges.filter((e) => e.includes(": after "))).toHaveLength(5)
      expect(edges).toContain("checkingQuota --> streaming: always [withinQuota]")
      expect(edges).not.toContainEqual(expect.stringContaining("xstate."))
    })

    it("leaves none of the spike's working states as a dead end", () => {
      const machine = parseXState(spike) as { states: Record<string, unknown> }
      expect(Object.keys(machine.states)).toContain("worker")
      const edges = drawn(spike)
      const from = new Set(edges.map((e) => e.split(" --> ")[0]))
      for (const state of ["authenticating", "committing", "delivered", "scanning", "resizing", "inserting", "broadcasting"]) expect(from.has(state), state).toBe(true)
    })

    it("says on a state what it invokes, on a line of its own", () => {
      const diagram = xstateToMermaid(spike)
      expect(diagram).toContain('state "authenticating<br/>invoke verifyToken" as')
      expect(diagram).toContain('state "scanning<br/>invoke scanObject" as')
      const { svg } = render(diagram)
      expect(svg).toContain("invoke verifyToken")
      expect(svg).toContain("error")
    })

    it("reads the machine's source, and doesn't run a thing in it", () => {
      const code = `
        const logic = fromPromise(async () => globalThis.mustNeverRun())
        createMachine({
          id: "m", initial: "a",
          states: {
            a: { invoke: { src: logic, input: globalThis.mustNeverRun(), onDone: { target: "b", actions: () => globalThis.mustNeverRun() } } },
            b: { invoke: { src: fromPromise(async () => globalThis.mustNeverRun()), id: globalThis.mustNeverRun(), onDone: "c", onError: "a" } },
            c: { invoke: [{ src: () => globalThis.mustNeverRun(), onDone: "d" }, { src: function named() { globalThis.mustNeverRun() }, onDone: "d" }] },
            d: { invoke: { src: actors.fetch, systemId: globalThis.mustNeverRun(), onSnapshot: "d" } },
          },
        })`
      const diagram = xstateToMermaid(code)
      expect(diagram).toContain('state "a<br/>invoke logic"')
      expect(diagram).toContain('state "b<br/>invoke actor"')
      expect(diagram).toContain('state "c<br/>invoke actor, named"')
      expect(diagram).toContain('state "d<br/>invoke fetch"')
      expect(drawn(code)).toEqual(expect.arrayContaining(["a --> b: done", "b --> c: done", "b --> a: error", "c --> d: done", "d --> d: snapshot"]))
      expect(parseXState(code)).not.toHaveProperty("states.a.invoke.input")
    })

    it("follows an invoke through a name, and keeps a list's order", () => {
      const code = `
        const load = { src: "load", onDone: "b" } as const
        createMachine({ initial: "a", states: { a: { invoke: load }, b: { invoke: [load, { src: "other", id: "second", onError: "a" }] } } })`
      const parsed = parseXState(code) as { states: { b: { invoke: { src: string; id?: string }[] } } }
      expect(parsed.states.b.invoke.map((i) => i.src)).toEqual(["load", "other"])
      expect(parsed.states.b.invoke[1]!.id).toBe("second")
      expect(drawn(code)).toEqual(expect.arrayContaining(["a --> b: done", "b --> b: done", "b --> a: error"]))
    })

    it("refuses an invoke it can't read, rather than guessing", () => {
      expect(() => xstateToMermaid(`createMachine({ initial: "a", states: { a: { invoke: getInvoke() } } })`)).toThrow(/static machine config/)
      expect(() => xstateToMermaid(`createMachine({ initial: "a", states: { a: { invoke: { ...stuff, src: "x" } } } })`)).toThrow(/literal properties/)
      expect(() => xstateToMermaid(`createMachine({ initial: "a", states: { a: { invoke: { [key]: "x", src: "x" } } } })`)).toThrow(/literal properties/)
      expect(() => xstateToMermaid(`createMachine({ initial: "a", states: { a: { invoke: { src: "x", onDone: nowhere() } } } })`)).toThrow(/static machine config/)
      expect(() => xstateToMermaid(`{ "initial": "a", "states": { "a": { "invoke": { "src": "x", "onDone": "nope" } } } }`)).toThrow(/nope/)
    })

    it("gives an invoke with no src a name, as XState needs one", () => {
      expect(xstateToMermaid(`createMachine({ initial: "a", states: { a: { invoke: { onDone: "b" } }, b: {} } })`)).toContain('state "a<br/>invoke actor"')
      // In JSON it goes straight to XState, which makes up a name for it that isn't one to show.
      expect(xstateToMermaid(JSON.stringify({ initial: "a", states: { a: { invoke: { onDone: "b" } }, b: {} } }))).toContain('state "a<br/>invoke actor"')
    })

    it("draws onDone on a nested state, and on what's invoked inside one", () => {
      const code = `createMachine({ id: "m", initial: "outer", states: {
        outer: { initial: "inner", onDone: "after", states: {
          inner: { invoke: { src: "deep", onDone: { target: "end", guard: "ok" }, onError: "#m.failed" } },
          end: { type: "final" },
        } },
        after: {},
        failed: {},
      } })`
      expect(drawn(code)).toEqual(expect.arrayContaining(["outer --> after: done", "inner --> end: done [ok]", "inner --> failed: error"]))
    })

    it("treats a state called invoke as a state, and an event too", () => {
      const code = `createMachine({ initial: "invoke", states: { invoke: { on: { invoke: "src" } }, src: {} } })`
      expect(drawn(code)).toEqual(["invoke --> src: invoke"])
    })

    it("reads JSON the same way", () => {
      const json = JSON.stringify({ id: "m", initial: "a", states: { a: { invoke: { src: "load", input: { x: 1 }, onDone: "b", onError: "c" } }, b: {}, c: {} } })
      expect(drawn(json)).toEqual(["a --> b: done", "a --> c: error"])
      expect(xstateToMermaid(json)).toContain("invoke load")
    })
  })

  describe("what's inside what, as it's drawn", () => {
    /** Each state's box in the picture, by the alias it's given, in the order the states are walked. */
    function boxes(code: string) {
      const { svg } = render(xstateToMermaid(code))
      const out = new Map<string, { x: number; y: number; w: number; h: number }>()
      for (const m of svg.matchAll(/<g class="pele-cluster[^"]*" data-id="(s\d+)"[^>]*><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
        out.set(m[1]!, { x: +m[2]!, y: +m[3]!, w: +m[4]!, h: +m[5]! })
      }
      for (const m of svg.matchAll(/<g class="pele-node[^"]*" data-id="(s\d+)" transform="translate\(([\d.-]+),([\d.-]+)\)"[^>]*><rect x="([\d.-]+)" y="([\d.-]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
        out.set(m[1]!, { x: +m[2]! + +m[4]!, y: +m[3]! + +m[5]!, w: +m[6]!, h: +m[7]! })
      }
      return out
    }
    /** Fails if a state's box isn't inside the box of what holds it, in the machine that XState makes of it. */
    function expectNested(code: string) {
      const drawn = boxes(code)
      const aliases = new Map<AnyStateNode, string>()
      const index = (node: AnyStateNode) => { aliases.set(node, `s${aliases.size}`); Object.values(node.states).forEach(index) }
      index(createMachine(parseXState(code)).root)
      expect(drawn.size).toBe(aliases.size)
      for (const [node, alias] of aliases) {
        if (!node.parent) continue
        const inner = drawn.get(alias)!, outer = drawn.get(aliases.get(node.parent)!)!
        const inside = inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h
        expect(inside, `${node.id} in ${node.parent.id}: ${JSON.stringify({ inner, outer })}`).toBe(true)
      }
    }

    it("keeps all of the spike's states inside what holds them", () => {
      expectNested(readFileSync(join(__dirname, "__fixtures__/upload-machine.txt"), "utf8"))
    })

    it("does it with an edge from a state that holds others", () => {
      expectNested(JSON.stringify({ id: "m", initial: "a", states: {
        a: { on: { GO: "p" } },
        p: { initial: "x", onDone: "z", on: { LEAVE: "a" }, states: { x: {} } },
        z: {},
      } }))
    })

    it("does it with edges that cross out of a block, into one, and over a parallel state's regions", () => {
      expectNested(JSON.stringify({ id: "m", initial: "a", on: { RESET: ".a", DEEP: ".p.r1.x" }, states: {
        a: { on: { GO: "p", IN: "b.inner" } },
        b: { initial: "inner", on: { DOWN: ".inner", OUT: "#m.a" }, states: { inner: { on: { UP: "#m.b", ACROSS: "#m.p.r2.y" } } } },
        p: { type: "parallel", onDone: "z", states: {
          r1: { initial: "x", states: { x: { on: { CROSS: "#m.p.r2.y", END: "end" } }, end: { type: "final" } } },
          r2: { initial: "y", states: { y: { on: { BACK: "#m" } } } },
        } },
        z: { on: { BACK: "a" } },
      } }))
    })

    it("does it with a parallel state as the machine", () => {
      expectNested(JSON.stringify({ id: "m", type: "parallel", on: { RESET: ".first" }, states: {
        first: { initial: "off", states: { off: { on: { TOGGLE: "on" } }, on: {} } },
        second: { initial: "idle", states: { idle: {} } },
      } }))
    })

    it("writes each edge outside every block, as a block would take what an edge names", () => {
      const diagram = xstateToMermaid(readFileSync(join(__dirname, "__fixtures__/upload-machine.txt"), "utf8"))
      expect(diagram).not.toMatch(/^ {3,}s\d+ --> s\d+/m)
    })
  })

  describe("what else a state or an edge says", () => {
    const code = (states: string) => `createMachine({ initial: "a", states: ${states} })`

    it("names a guard however it's written", () => {
      const diagram = xstateToMermaid(code(`{
        a: { on: {
          ONE: { target: "b", guard: "named" }, TWO: { target: "b", guard: { type: "withParams", params: { x: globalThis.mustNeverRun() } } },
          THREE: { target: "b", guard: not("x") }, FOUR: { target: "b", guard: () => globalThis.mustNeverRun() }, FIVE: { target: "b", guard: someGuard },
          SIX: { target: "b", guard: helpers.check("x") },
        } },
        b: { always: { guard: "ready", target: "a" } },
      }`))
      for (const text of ["ONE [named]", "TWO [withParams]", "THREE [not]", "FOUR [guard]", "FIVE [someGuard]", "SIX [check]", "always [ready]"]) expect(diagram).toContain(text)
    })

    it("names a guard in JSON, as an object too", () => {
      expect(xstateToMermaid(JSON.stringify({ initial: "a", states: { a: { on: { GO: { target: "a", guard: { type: "fromJson" } } } } } }))).toContain("GO [fromJson]")
    })

    it("says which are parallel and which are history", () => {
      const diagram = xstateToMermaid(`createMachine({ initial: "p", states: {
        p: { type: "parallel", states: { r1: { initial: "x", states: { x: {}, h: { type: "history" }, d: { type: "history", history: "deep" } } }, r2: {} } },
      } })`)
      expect(diagram).toContain('state "p<br/>parallel"')
      expect(diagram).toContain('state "h<br/>history"')
      expect(diagram).toContain('state "d<br/>deep history"')
    })

    it("escapes what it adds, too", () => {
      const diagram = xstateToMermaid(JSON.stringify({ initial: "a", states: { a: { invoke: { src: '<img src=x onerror="y">' } } } }))
      expect(diagram).toContain("&lt;img")
      expect(render(diagram).svg).not.toContain("<img")
    })
  })
})
