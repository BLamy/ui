import { describe, expect, it } from "vitest"
import { parseXState, xstateToMermaid } from "./machine"
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
})
