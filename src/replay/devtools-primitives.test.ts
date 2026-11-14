// @vitest-environment happy-dom
/* The two primitives behind the replay DevTools: the docked panel's resize separator and the Network table's rows. */
import { checkServer, mount } from "@ui-sdk/core/testing"
import { afterEach, describe, expect, it } from "vitest"
import { devtoolsPanel, requestTable } from "./devtools-primitives"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

let view: { unmount: () => void } | undefined
afterEach(() => {
  view?.unmount()
  view = undefined
})

describe("devtoolsPanel: the panel and the separator on its top edge", () => {
  const markup = `<root aria-label="DevTools"><resize aria-label="Resize DevTools"></resize></root>`

  it("the separator is a focusable window splitter that reports the panel's height and points at the panel", () => {
    const panel = mount(devtoolsPanel, { defaultSize: 58 }, markup)
    view = panel
    const handle = panel.part("resize")!
    expect(panel.root.getAttribute("data-slot")).toBe("replay-devtools")
    expect(handle.getAttribute("data-slot")).toBe("replay-devtools-resize")
    expect(handle.getAttribute("role")).toBe("separator")
    expect(handle.getAttribute("tabindex")).toBe("0")
    expect(handle.getAttribute("aria-orientation")).toBe("horizontal")
    expect(handle.getAttribute("aria-label")).toBe("Resize DevTools")
    expect([handle.getAttribute("aria-valuemin"), handle.getAttribute("aria-valuenow"), handle.getAttribute("aria-valuemax")]).toEqual(["22", "58", "92"])
    expect(handle.getAttribute("aria-valuetext")).toBe("58% of the page")
    expect(handle.getAttribute("aria-controls")).toBe(panel.root.id)
    expect(panel.root.style.getPropertyValue("--replay-devtools-height")).toBe("58%")
  })

  it("the arrow keys step it (Shift for more), Home and End go to its limits, and every step is a change with a reason", async () => {
    const sizes: [number, string][] = []
    const panel = mount(devtoolsPanel, { defaultSize: 58, onSizeChange: (size, details) => sizes.push([size, details.reason]) }, markup)
    view = panel
    const handle = panel.part("resize")!
    handle.focus()
    await panel.keys("ArrowUp")
    expect(panel.state.size).toBe(60)
    await panel.keys("ArrowDown", "ArrowDown")
    expect(panel.state.size).toBe(56)
    await panel.keys("Shift+ArrowUp")
    expect(panel.state.size).toBe(66)
    await panel.keys("Home")
    expect(panel.state.size).toBe(22)
    // At a limit a step is no change.
    await panel.keys("ArrowDown")
    expect(panel.state.size).toBe(22)
    await panel.keys("End")
    expect(panel.state.size).toBe(92)
    expect(sizes).toEqual([[60, "resize-key"], [58, "resize-key"], [56, "resize-key"], [66, "resize-key"], [22, "resize-key"], [92, "resize-key"]])
    expect(handle.getAttribute("aria-valuenow")).toBe("92")
    expect(panel.root.style.getPropertyValue("--replay-devtools-height")).toBe("92%")
    expect(document.activeElement).toBe(handle)
    expect(panel.changes.at(-1)).toMatchObject({ key: "size", source: "keyboard" })
  })

  it("a controlled size only moves when the owner passes the new one, and other keys are left alone", async () => {
    const asked: number[] = []
    const panel = mount(devtoolsPanel, { size: 40, onSizeChange: (size) => asked.push(size) }, markup)
    view = panel
    panel.part("resize")!.focus()
    await panel.keys("ArrowUp", "ArrowLeft", "a")
    expect(asked).toEqual([42])
    expect(panel.state.size).toBe(40)
  })

  it("dragging the separator sets the height from where the pointer is in the stage, as a drag", async () => {
    const reasons: string[] = []
    const panel = mount(devtoolsPanel, { defaultSize: 58, onSizeChange: (_size, details) => reasons.push(details.reason) }, markup)
    view = panel
    const handle = panel.part("resize")!
    const rect = (top: number, height: number) => () => ({ left: 0, right: 600, width: 600, top, bottom: top + height, height, x: 0, y: top, toJSON() {} }) as DOMRect
    // A 400px stage, the separator on the panel's top edge at 58%.
    panel.root.parentElement!.getBoundingClientRect = rect(0, 400)
    handle.getBoundingClientRect = rect(165, 7)
    await panel.drag(handle, { by: { x: 0, y: -40 } })
    expect(panel.state.size).toBeGreaterThan(66)
    expect(panel.state.size).toBeLessThan(70)
    expect(new Set(reasons)).toEqual(new Set(["drag"]))
    expect(panel.state.dragging).toBe(false)
    expect(handle.hasAttribute("data-dragging")).toBe(false)
    // Past the stage's top the panel stops at its largest.
    await panel.drag(handle, { by: { x: 0, y: -900 } })
    expect(panel.state.size).toBe(92)
  })

  it("setSize sets it from code, within the limits", () => {
    const reasons: string[] = []
    const panel = mount(devtoolsPanel, { onSizeChange: (_size, details) => reasons.push(details.reason) }, markup)
    view = panel
    expect(panel.api.setSize(40)).toBe(true)
    expect(panel.state.size).toBe(40)
    panel.api.setSize(5)
    expect(panel.state.size).toBe(22)
    expect(reasons).toEqual(["imperative", "imperative"])
  })

  it("renders on the server with its height and its ARIA", () => {
    checkServer(devtoolsPanel, { defaultSize: 72 }, markup)
  })
})

describe("requestTable: a grid of rows, one of which is selected", () => {
  const markup = `<root aria-label="Requests"><tbody><row value="a"><td>a</td></row><row value="b"><td>b</td></row><row value="c"><td>c</td></row></tbody></root>`

  it("is a grid whose rows say whether they're selected, with one tab stop", () => {
    const table = mount(requestTable, { defaultValue: "b" }, markup)
    view = table
    expect(table.root.getAttribute("role")).toBe("grid")
    expect(table.root.getAttribute("data-slot")).toBe("replay-devtools-table")
    const rows = ["a", "b", "c"].map((key) => table.part("row", key)!)
    expect(rows.map((r) => r.getAttribute("role"))).toEqual(["row", "row", "row"])
    expect(rows.map((r) => r.getAttribute("data-slot"))).toEqual(Array(3).fill("replay-devtools-table-row"))
    expect(rows.map((r) => r.getAttribute("aria-selected"))).toEqual(["false", "true", "false"])
    expect(rows.map((r) => r.hasAttribute("data-selected"))).toEqual([false, true, false])
    // The stop starts on the selected row.
    expect(rows.map((r) => r.getAttribute("tabindex"))).toEqual(["-1", "0", "-1"])
  })

  it("without a selection the first row holds the stop; arrows, Home and End move focus without selecting", async () => {
    const table = mount(requestTable, {}, markup)
    view = table
    const row = (key: string) => table.part("row", key)!
    expect(["a", "b", "c"].map((key) => row(key).getAttribute("tabindex"))).toEqual(["0", "-1", "-1"])
    await table.keys("Tab")
    expect(document.activeElement).toBe(row("a"))
    await table.keys("ArrowDown")
    expect(document.activeElement).toBe(row("b"))
    await table.keys("ArrowDown", "ArrowDown")
    expect(document.activeElement).toBe(row("c"))
    await table.keys("ArrowUp")
    expect(document.activeElement).toBe(row("b"))
    await table.keys("End")
    expect(document.activeElement).toBe(row("c"))
    await table.keys("Home")
    expect(document.activeElement).toBe(row("a"))
    expect(table.state.value).toBeNull()
    expect(["a", "b", "c"].map((key) => row(key).getAttribute("tabindex"))).toEqual(["0", "-1", "-1"])
  })

  it("Enter, Space and a click select a row; the same on the selected row clears it", async () => {
    const values: (string | null)[] = []
    const table = mount(requestTable, { onValueChange: (value) => values.push(value) }, markup)
    view = table
    const row = (key: string) => table.part("row", key)!
    await table.keys("Tab", "ArrowDown", "Enter")
    expect(table.state.value).toBe("b")
    expect(row("b").getAttribute("aria-selected")).toBe("true")
    await table.keys("Space")
    expect(table.state.value).toBeNull()
    await table.keys("ArrowDown", "Space")
    expect(table.state.value).toBe("c")
    await table.click(row("a"))
    expect(table.state.value).toBe("a")
    expect(["a", "b", "c"].map((key) => row(key).getAttribute("aria-selected"))).toEqual(["true", "false", "false"])
    await table.click(row("a"))
    expect(values).toEqual(["b", null, "c", "a", null])
    expect(table.changes.at(-1)).toMatchObject({ key: "value", reason: "item-press" })
  })

  it("renders on the server with its selection and its one tab stop", () => {
    checkServer(requestTable, { defaultValue: "b" }, markup)
  })
})
