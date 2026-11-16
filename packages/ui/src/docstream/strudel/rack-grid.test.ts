// @vitest-environment happy-dom
import { checkDirection, checkServer, mount } from "@ui-sdk/core/testing"
import { createAgent } from "@ui-sdk/core/agent"
import { describe, expect, it } from "vitest"
import { rackGrid, type RackGridSizes } from "./rack-grid"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

// happy-dom doesn't read `dir` into the computed direction, which is where UI SDK reads it from.
document.head.append(Object.assign(document.createElement("style"), { textContent: '[dir="rtl"] { direction: rtl }' }))

const module = (key: string, name: string) =>
  `<item value="${key}" span="6">${name}<grip as="button" aria-label="Move ${name}"></grip><corner as="button" aria-label="Resize ${name}"></corner></item>`
const MARKUP = `<root aria-label="Modules">${module("master", "Master")}${module("drums", "Drums")}${module("bass", "Bass")}</root>`
const ORDER = ["master", "drums", "bass"]
const names: Record<string, string> = { master: "Master", drums: "Drums", bass: "Bass" }
const label = (key: string) => names[key]

const grips = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-slot="rack-grid-grip"]')]
const corners = (root: HTMLElement) => [...root.querySelectorAll<HTMLElement>('[data-slot="rack-grid-corner"]')]

describe("rack-grid primitive", () => {
  it("is a list of modules, each with a named move button and a named resize button in the tab order", () => {
    const view = mount(rackGrid, { defaultOrder: ORDER, label }, MARKUP)
    try {
      expect(view.root.getAttribute("role")).toBe("list")
      expect(view.root.querySelectorAll('[role="listitem"]')).toHaveLength(3)
      expect(grips(view.root).map((g) => [g.tagName, g.getAttribute("type"), g.getAttribute("aria-label"), g.getAttribute("aria-pressed")])).toEqual([
        ["BUTTON", "button", "Move Master", "false"],
        ["BUTTON", "button", "Move Drums", "false"],
        ["BUTTON", "button", "Move Bass", "false"],
      ])
      expect(corners(view.root).map((c) => c.getAttribute("aria-label"))).toEqual(["Resize Master", "Resize Drums", "Resize Bass"])
      expect([...grips(view.root), ...corners(view.root)].some((el) => el.hasAttribute("tabindex"))).toBe(false)
    } finally {
      view.unmount()
    }
  })

  it("Space picks a module up, arrows move it, Space drops it: one order change, each step announced", async () => {
    const orders: string[][] = []
    const view = mount(rackGrid, { defaultOrder: ORDER, label, onOrderChange: (order) => orders.push(order) }, MARKUP)
    try {
      const [master] = grips(view.root)
      master!.focus()
      await view.keys("Space")
      expect(view.state.moving?.key).toBe("master")
      expect(master!.getAttribute("aria-pressed")).toBe("true")
      expect(view.part("item", "master")!.hasAttribute("data-moving")).toBe(true)
      await view.keys("ArrowRight", "ArrowRight")
      // Nothing is committed while it's up.
      expect(orders).toEqual([])
      expect(view.state.moving?.order).toEqual(["drums", "bass", "master"])
      await view.keys("Space")
      await view.settle()
      expect(orders).toEqual([["drums", "bass", "master"]])
      expect(view.state.order).toEqual(["drums", "bass", "master"])
      expect(view.state.moving).toBeNull()
      expect(view.changes.at(-1)).toMatchObject({ key: "order", reason: "move-key" })
      expect(view.announced.some((text) => text.includes("Master"))).toBe(true)
      expect(view.announced.length).toBeGreaterThanOrEqual(3)
    } finally {
      view.unmount()
    }
  })

  it("Home and End move a picked-up module to the ends, and Escape puts it back", async () => {
    const view = mount(rackGrid, { defaultOrder: ORDER, label }, MARKUP)
    try {
      grips(view.root)[1]!.focus()
      await view.keys("Enter", "End")
      expect(view.state.moving?.order).toEqual(["master", "bass", "drums"])
      await view.keys("Home")
      expect(view.state.moving?.order).toEqual(["drums", "master", "bass"])
      await view.keys("Escape")
      expect(view.state.moving).toBeNull()
      expect(view.state.order).toEqual(ORDER)
    } finally {
      view.unmount()
    }
  })

  it("arrows on a grip that isn't picked up move nothing", async () => {
    const view = mount(rackGrid, { defaultOrder: ORDER, label }, MARKUP)
    try {
      grips(view.root)[0]!.focus()
      await view.keys("ArrowRight", "End")
      expect(view.state.moving).toBeNull()
      expect(view.state.order).toEqual(ORDER)
    } finally {
      view.unmount()
    }
  })

  it("the corner's arrows resize: Left and Right by a column, Up and Down by 24px, each committed and announced", async () => {
    const commits: RackGridSizes[] = []
    const view = mount(rackGrid, { defaultOrder: ORDER, label, columns: 6, onSizesCommit: (sizes) => commits.push(sizes) }, MARKUP)
    try {
      corners(view.root)[1]!.focus()
      await view.keys("ArrowRight")
      // Six columns: a column is two twelfths. The width starts from the module's own span.
      expect(view.state.sizes).toEqual({ drums: { w: 8 } })
      expect(view.changes.at(-1)).toMatchObject({ key: "sizes", reason: "handle-key", source: "keyboard" })
      await view.keys("ArrowLeft", "ArrowLeft")
      expect(view.state.sizes.drums).toEqual({ w: 4 })
      await view.keys("ArrowDown")
      expect(view.state.sizes.drums).toEqual({ w: 4, h: 144 })
      await view.keys("ArrowUp", "ArrowUp")
      expect(view.state.sizes.drums).toEqual({ w: 4, h: 96 })
      expect(commits).toHaveLength(6)
      await view.settle()
      expect(view.announced).toContain("Drums, 2 of 6 columns wide")
      expect(view.announced).toContain("Drums, at least 96 pixels tall")
    } finally {
      view.unmount()
    }
  })

  it("a width stops at one column and at the full grid", async () => {
    const view = mount(rackGrid, { defaultOrder: ORDER, label, columns: 4, defaultSizes: { bass: { w: 3 } } }, MARKUP)
    try {
      corners(view.root)[2]!.focus()
      await view.keys("ArrowLeft", "ArrowLeft")
      expect(view.state.sizes.bass).toEqual({ w: 3 })
      for (let i = 0; i < 5; i++) await view.keys("ArrowRight")
      expect(view.state.sizes.bass).toEqual({ w: 12 })
    } finally {
      view.unmount()
    }
  })

  it("right to left, the corner's Left widens", async () => {
    const view = mount(rackGrid, { defaultOrder: ORDER, label }, MARKUP)
    try {
      view.root.setAttribute("dir", "rtl")
      corners(view.root)[0]!.focus()
      await view.keys("ArrowLeft")
      expect(view.state.sizes.master).toEqual({ w: 7 })
    } finally {
      view.unmount()
    }
  })

  it("a controlled grid asks for the order and the sizes, and shows what it's given", async () => {
    const asked: unknown[] = []
    const view = mount(rackGrid, { order: ORDER, sizes: {}, label, onOrderChange: (order) => asked.push(order), onSizesChange: (sizes) => asked.push(sizes) }, MARKUP)
    try {
      grips(view.root)[0]!.focus()
      await view.keys("Space", "ArrowRight", "Space")
      corners(view.root)[0]!.focus()
      await view.keys("ArrowRight")
      expect(asked).toEqual([["drums", "master", "bass"], { master: { w: 7 } }])
      expect(view.state.sizes).toEqual({})
    } finally {
      view.unmount()
    }
  })

  it("renders on the server", () => {
    const html = checkServer(rackGrid, { defaultOrder: ORDER, label }, MARKUP)
    expect(html).toContain('role="list"')
    expect(html.match(/role="listitem"/g)).toHaveLength(3)
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(3)
  })

  it("its agent actions move and resize a module through the same change and commit, as `imperative`", async () => {
    const orders: string[][] = []
    const commits: RackGridSizes[] = []
    const view = mount(rackGrid, { defaultOrder: ORDER, label, onOrderChange: (order) => orders.push(order), onSizesCommit: (sizes) => commits.push(sizes) }, MARKUP)
    try {
      expect(view.api.move("bass", 0)).toBe(true)
      expect(view.state.order).toEqual(["bass", "master", "drums"])
      expect(orders).toEqual([["bass", "master", "drums"]])
      expect(view.changes.at(-1)).toMatchObject({ key: "order", reason: "imperative" })
      // Past the end lands at the end; an unknown module moves nothing.
      expect(view.api.move("bass", 99)).toBe(true)
      expect(view.state.order).toEqual(["master", "drums", "bass"])
      expect(view.api.move("nope", 0)).toBe(false)
      expect(view.api.resize("drums", { w: 20, h: -10 })).toBe(true)
      expect(view.state.sizes.drums).toEqual({ w: 12, h: 0 })
      expect(view.changes.at(-1)).toMatchObject({ key: "sizes", reason: "imperative" })
      expect(commits).toEqual([{ drums: { w: 12, h: 0 } }])
      expect(view.api.resize("drums", { w: 12 })).toBe(false)
      // An agent finds the grid by its name and calls the same actions.
      const agent = createAgent()
      const entry = agent.snapshot().find((e) => e.label === "Modules")
      expect(entry?.actions).toEqual(expect.arrayContaining(["move", "resize"]))
      const result = await agent.act({ steps: [{ ref: "Modules", action: "move", args: ["master", 2] }] })
      expect(result.ok, result.error?.message).toBe(true)
      expect(view.state.order).toEqual(["drums", "bass", "master"])
    } finally {
      view.unmount()
    }
  })

  it("the corner is a button that declares its arrow keys, and both directions work", async () => {
    const view = mount(rackGrid, { defaultOrder: ORDER, label }, MARKUP)
    try {
      for (const corner of corners(view.root)) expect(corner.tagName).toBe("BUTTON")
    } finally {
      view.unmount()
    }
    // The corners alone, so the first tab stop is one whose Left and Right mean narrower and wider.
    const cornersOnly = `<root aria-label="Modules">${["master", "drums"].map((key) => `<item value="${key}" span="6">${names[key]}<corner as="button" aria-label="Resize ${names[key]}"></corner></item>`).join("")}</root>`
    await checkDirection(rackGrid, { defaultOrder: ["master", "drums"], label }, cornersOnly)
  })
})
