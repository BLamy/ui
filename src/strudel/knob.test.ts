// @vitest-environment happy-dom
import { checkPattern, checkServer, mount } from "@ui-sdk/core/testing"
import { describe, expect, it } from "vitest"
import { knob } from "./knob"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

const MARKUP = `<root><dial aria-label="Cutoff"></dial><value></value></root>`

describe("knob primitive", () => {
  it("is one tab stop: a named slider with its bounds, value and text", async () => {
    const view = mount(knob, { defaultValue: 50, min: 0, max: 100, valueText: (v) => `${v} Hz` }, MARKUP)
    try {
      const dial = view.part("dial")!
      expect(dial.getAttribute("role")).toBe("slider")
      expect(dial.getAttribute("tabindex")).toBe("0")
      expect(dial.getAttribute("aria-valuemin")).toBe("0")
      expect(dial.getAttribute("aria-valuemax")).toBe("100")
      expect(dial.getAttribute("aria-valuenow")).toBe("50")
      expect(dial.getAttribute("aria-valuetext")).toBe("50 Hz")
      expect(dial.hasAttribute("aria-disabled")).toBe(false)
      await view.keys("Tab")
      expect(document.activeElement).toBe(dial)
      await checkPattern(view.root, "slider")
    } finally {
      view.unmount()
    }
  })

  it("steps along its travel with the shared keyboard map", async () => {
    const view = mount(knob, { defaultValue: 50, min: 0, max: 100 }, MARKUP)
    try {
      await view.keys("Tab", "ArrowUp")
      expect(view.state.value).toBeCloseTo(55, 6)
      expect(view.changes.at(-1)).toMatchObject({ key: "value", reason: "step-key", source: "keyboard" })
      await view.keys("ArrowRight")
      expect(view.state.value).toBeCloseTo(60, 6)
      await view.keys("ArrowDown", "ArrowLeft")
      expect(view.state.value).toBeCloseTo(50, 6)
      await view.keys("PageUp")
      expect(view.state.value).toBeCloseTo(70, 6)
      await view.keys("Shift+ArrowDown")
      expect(view.state.value).toBeCloseTo(50, 6)
      await view.keys("Alt+ArrowUp")
      expect(view.state.value).toBeCloseTo(51, 6)
      await view.keys("End")
      expect(view.state.value).toBeCloseTo(100, 6)
      await view.keys("Home")
      expect(view.state.value).toBeCloseTo(0, 6)
      expect(view.part("dial")!.getAttribute("aria-valuenow")).toBe("0")
    } finally {
      view.unmount()
    }
  })

  it("steps a log scale evenly along the travel, not the value", async () => {
    const view = mount(knob, { defaultValue: 20, min: 20, max: 20000, scale: "log" }, MARKUP)
    try {
      // Half the travel is the geometric middle.
      await view.keys("Tab", "PageUp", "PageUp")
      await view.keys("ArrowUp", "ArrowUp")
      expect(view.state.value).toBeCloseTo(Math.sqrt(20 * 20000), 3)
    } finally {
      view.unmount()
    }
  })

  it("turns with a vertical drag, and a double-click goes back to the reset value", async () => {
    const commits: number[] = []
    const view = mount(knob, { defaultValue: 50, min: 0, max: 100, travel: 100, resetValue: 25, onValueCommit: (v) => commits.push(v) }, MARKUP)
    try {
      const dial = view.part("dial")!
      await view.drag(dial, { by: { x: 0, y: -20 } })
      expect(view.state.value).toBeCloseTo(70, 5)
      expect(view.changes.at(-1)).toMatchObject({ key: "value", reason: "drag" })
      expect(commits).toEqual([view.state.value])
      expect(view.state.dragging).toBe(false)
      expect(document.activeElement).toBe(dial)
      dial.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
      expect(view.state.value).toBe(25)
      expect(view.changes.at(-1)).toMatchObject({ reason: "reset-press" })
    } finally {
      view.unmount()
    }
  })

  it("a controlled knob asks and waits; a canceled change doesn't move it", async () => {
    const asked: number[] = []
    const view = mount(knob, { value: 10, min: 0, max: 100, onValueChange: (v) => asked.push(v) }, MARKUP)
    try {
      await view.keys("Tab", "ArrowUp")
      expect(asked).toEqual([15])
      expect(view.state.value).toBe(10)
    } finally {
      view.unmount()
    }
    const refused = mount(knob, { defaultValue: 10, min: 0, max: 100, onValueChange: (_v, details) => details.cancel() }, MARKUP)
    try {
      await refused.keys("Tab", "ArrowUp")
      expect(refused.state.value).toBe(10)
    } finally {
      refused.unmount()
    }
  })

  it("disabled, it stays focusable and says so, and nothing moves it", async () => {
    const view = mount(knob, { defaultValue: 10, min: 0, max: 100, disabled: true, resetValue: 0 }, MARKUP)
    try {
      const dial = view.part("dial")!
      expect(dial.getAttribute("aria-disabled")).toBe("true")
      expect(view.root.hasAttribute("data-disabled")).toBe(true)
      await view.keys("Tab", "ArrowUp", "End")
      await view.drag(dial, { by: { x: 0, y: -40 } })
      dial.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
      expect(document.activeElement).toBe(dial)
      expect(view.state.value).toBe(10)
    } finally {
      view.unmount()
    }
  })

  it("renders on the server from options alone", () => {
    const html = checkServer(knob, { defaultValue: 440, min: 40, max: 16000, scale: "log", valueText: (v) => `${v} Hz` }, MARKUP)
    expect(html).toContain('role="slider"')
    expect(html).toContain('aria-valuenow="440"')
    expect(html).toContain('aria-valuetext="440 Hz"')
    expect(html).toContain('data-slot="knob-dial"')
  })
})
