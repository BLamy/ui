// @vitest-environment happy-dom
import { checkDirection, checkServer, mount } from "@ui-sdk/core/testing"
import { describe, expect, it } from "vitest"
import { stepGrid } from "./step-grid"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

// happy-dom doesn't read `dir` into the computed direction, which is where UI SDK reads it from.
document.head.append(Object.assign(document.createElement("style"), { textContent: '[dir="rtl"] { direction: rtl }' }))

const step = (key: string, text: string, pressed = true) =>
  `<cell as="button" value="${key}"${pressed ? " pressed" : ""} aria-label="${text || "Rest"}">${text}</cell><editor as="input" value="${key}" aria-label="Step value"></editor>`
const MARKUP = `<root aria-label="Drum steps">${step("0", "bd")}${step("1", "", false)}${step("2", "sd")}${step("3", "hh")}</root>`

describe("step-grid primitive", () => {
  it("is a named group of pressed-state buttons with one tab stop", async () => {
    const view = mount(stepGrid, {}, MARKUP)
    try {
      expect(view.root.getAttribute("role")).toBe("group")
      const cells = ["0", "1", "2", "3"].map((key) => view.part("cell", key)!)
      expect(cells.map((c) => c.getAttribute("aria-pressed"))).toEqual(["true", "false", "true", "true"])
      expect(cells.map((c) => c.getAttribute("tabindex"))).toEqual(["0", "-1", "-1", "-1"])
      expect(cells.map((c) => c.hasAttribute("data-pressed"))).toEqual([true, false, true, true])
      expect(cells.every((c) => c.getAttribute("type") === "button")).toBe(true)
      // No editor until a step is being typed over.
      expect(view.part("editor", "0")?.isConnected).toBeFalsy()
    } finally {
      view.unmount()
    }
  })

  it("Left and Right walk the steps, Home and End go to the ends, and the stop follows focus", async () => {
    const view = mount(stepGrid, {}, MARKUP)
    try {
      await view.keys("Tab")
      expect(document.activeElement).toBe(view.part("cell", "0"))
      await view.keys("ArrowRight", "ArrowRight")
      expect(document.activeElement).toBe(view.part("cell", "2"))
      await view.keys("ArrowLeft")
      expect(document.activeElement).toBe(view.part("cell", "1"))
      expect(view.part("cell", "1")!.getAttribute("tabindex")).toBe("0")
      expect(view.part("cell", "0")!.getAttribute("tabindex")).toBe("-1")
      await view.keys("End")
      expect(document.activeElement).toBe(view.part("cell", "3"))
      // Past the last step the arrow is still the grid's: focus stays.
      await view.keys("ArrowRight")
      expect(document.activeElement).toBe(view.part("cell", "3"))
      await view.keys("Home")
      expect(document.activeElement).toBe(view.part("cell", "0"))
    } finally {
      view.unmount()
    }
  })

  it("Space, Enter and a click press the focused step", async () => {
    const pressed: [string, string, string][] = []
    const view = mount(stepGrid, { onStepPress: (key, details) => pressed.push([key, details.reason, details.source]) }, MARKUP)
    try {
      await view.keys("Tab", "ArrowRight", "Space", "Enter")
      await view.click(view.part("cell", "3")!)
      expect(pressed.map(([key, reason]) => [key, reason])).toEqual([["1", "press"], ["1", "press"], ["3", "press"]])
      expect(pressed[2]![2]).toBe("mouse")
    } finally {
      view.unmount()
    }
  })

  it("F2 opens a step's editor; Enter commits its text and returns focus to the step", async () => {
    const edits: { step: string; text: string }[] = []
    const view = mount(stepGrid, { onStepEdit: (edit) => edits.push(edit) }, MARKUP)
    try {
      await view.keys("Tab", "ArrowRight", "ArrowRight", "F2")
      await view.settle()
      const editor = view.part("editor", "2") as HTMLInputElement
      expect(editor.isConnected).toBe(true)
      expect(view.part("cell", "2")?.isConnected).toBeFalsy()
      expect(document.activeElement).toBe(editor)
      editor.value = "cp"
      await view.keys("Enter")
      await view.settle()
      expect(edits).toEqual([{ step: "2", text: "cp" }])
      expect(view.state.editing).toBeNull()
      expect(document.activeElement).toBe(view.part("cell", "2"))
    } finally {
      view.unmount()
    }
  })

  it("Escape cancels the edit, a double-click opens it too, and leaving the editor commits without taking focus back", async () => {
    const edits: { step: string; text: string }[] = []
    const view = mount(stepGrid, { onStepEdit: (edit) => edits.push(edit) }, MARKUP)
    try {
      view.part("cell", "0")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
      await view.settle()
      const editor = view.part("editor", "0") as HTMLInputElement
      expect(document.activeElement).toBe(editor)
      editor.value = "nope"
      await view.keys("Escape")
      await view.settle()
      expect(edits).toEqual([])
      expect(document.activeElement).toBe(view.part("cell", "0"))

      await view.keys("F2")
      await view.settle()
      const again = view.part("editor", "0") as HTMLInputElement
      again.value = "rim"
      const outside = document.body.appendChild(document.createElement("button"))
      outside.focus()
      await view.settle()
      expect(edits).toEqual([{ step: "0", text: "rim" }])
      expect(document.activeElement).toBe(outside)
      outside.remove()
    } finally {
      view.unmount()
    }
  })

  it("without `editable`, F2 and a double-click leave the step alone", async () => {
    const view = mount(stepGrid, { editable: false }, MARKUP)
    try {
      await view.keys("Tab", "F2")
      view.part("cell", "0")!.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
      await view.settle()
      expect(view.state.editing).toBeNull()
    } finally {
      view.unmount()
    }
  })

  it("renders on the server with one stop, and Left and Right follow the reading direction", async () => {
    const html = checkServer(stepGrid, {}, MARKUP)
    expect(html.match(/tabindex="0"/g)).toHaveLength(1)
    expect(html).toContain('data-slot="step-grid-cell"')
    expect(html).not.toContain("<input")
    await checkDirection(stepGrid, {}, MARKUP)
  })
})
