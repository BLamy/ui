// @vitest-environment happy-dom
import { act, useState } from "react"
import { createRoot } from "react-dom/client"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TaskCheckbox } from "../docs/TaskCheckbox"
import { MarkdownContent } from "../docs/DocsRenderer"
import type { TaskState } from "./ast"
import { parseMarkdown } from "./parse"
import { serializeMarkdown } from "./serialize"
import { TASK_STATES, getTaskState } from "./tasks"

describe("extended task states", () => {
  const markdown = TASK_STATES.map((state) => `- [${state.marker}] ${state.label}`).join("\n") + "\n"
  it("parses all eight states and preserves their markers, including uppercase verified", () => {
    const doc = parseMarkdown(markdown)
    const list = doc.children[0]
    if (list.type !== "list") throw new Error("Expected a list")
    expect(list.items.map(getTaskState)).toEqual(TASK_STATES.map((state) => state.id))
    expect(list.items.filter((item) => item.checked)).toHaveLength(1)
    expect(serializeMarkdown(doc)).toBe(markdown)
    expect(serializeMarkdown(parseMarkdown("- [X] Checked\n"))).toBe("- [X] Checked\n")
  })
  it("retains nested and ordered task lists without treating arbitrary brackets as tasks", () => {
    for (const source of ["1. [b] Blocked\n   - [~] Working\n   - [?] Review\n", "- [n] Literal brackets\n"]) {
      expect(serializeMarkdown(parseMarkdown(source))).toBe(source)
    }
  })
  it("renders a distinct icon and an accessible mixed state for each intermediate status", () => {
    const html = renderToStaticMarkup(<MarkdownContent markdown={markdown} />)
    for (const state of TASK_STATES) expect(html).toContain(`data-state-icon="${state.id}"`)
    expect(html.match(/aria-checked="mixed"/g)).toHaveLength(6)
  })
  it("offers all icons on right click, clears any marked status on click, checks the next click and shows a state tooltip", async () => {
    const host = document.createElement("div"); document.body.append(host)
    const root = createRoot(host)
    function Fixture() { const [state, setState] = useState<TaskState>("in-progress"); return <TaskCheckbox state={state} onChange={setState} label="Review" /> }
    await act(async () => { root.render(<Fixture />) })
    const checkbox = () => host.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    await act(async () => { checkbox().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 40 })) })
    const menu = document.querySelector('[role="menu"]')!
    expect(menu.querySelectorAll('[role="menuitemradio"]')).toHaveLength(8)
    expect(menu.querySelectorAll('[data-state-icon]')).toHaveLength(8)
    await act(async () => { menu.querySelector<HTMLButtonElement>('[data-state="blocked"]')!.click() })
    expect(checkbox().getAttribute("aria-checked")).toBe("mixed")
    expect(host.querySelector('[data-state-icon="blocked"]')).not.toBeNull()
    await act(async () => { checkbox().click() })
    expect(checkbox().checked).toBe(false)
    expect(host.querySelector('[data-task-state="pending"]')).not.toBeNull()
    await act(async () => { checkbox().click() })
    expect(checkbox().checked).toBe(true)
    await act(async () => { checkbox().dispatchEvent(new MouseEvent("mouseover", { bubbles: true })); await new Promise((resolve) => setTimeout(resolve, 450)) })
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe("Verified")
    await act(async () => { root.unmount() }); host.remove()
  })
  it("opens the state menu with Shift+F10 and supports Escape", async () => {
    const host = document.createElement("div"); document.body.append(host)
    const root = createRoot(host)
    await act(async () => { root.render(<TaskCheckbox state="pending" onChange={() => {}} />) })
    const checkbox = host.querySelector("input")!
    await act(async () => { checkbox.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true, cancelable: true })) })
    const menu = document.querySelector('[role="menu"]')!
    expect(document.activeElement?.getAttribute("data-state")).toBe("pending")
    await act(async () => { menu.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true })) })
    expect(document.querySelector('[role="menu"]')).toBeNull()
    expect(document.activeElement).toBe(checkbox)
    await act(async () => { root.unmount() }); host.remove()
  })
})
