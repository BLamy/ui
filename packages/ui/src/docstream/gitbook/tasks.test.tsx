// @vitest-environment happy-dom
import { act, useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { TaskCheckbox } from "../docs/TaskCheckbox"
import { click, focus, mount, press, tick } from "../__fixtures__/dom"
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
  it("offers all icons on right click, clears any marked status on click, checks the next click and describes the state in a tooltip", async () => {
    function Fixture() { const [state, setState] = useState<TaskState>("in-progress"); return <TaskCheckbox state={state} onValueChange={setState} label="Review" /> }
    const { host, unmount } = await mount(<Fixture />)
    const checkbox = () => host.querySelector<HTMLElement>('[role="checkbox"]')!
    await act(async () => { checkbox().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40, clientY: 40 })) })
    await tick()
    const menu = host.querySelector('[role="menu"]')!
    expect(menu.getAttribute("aria-label")).toBe("Task state")
    expect(menu.querySelectorAll('[role="menuitemradio"]')).toHaveLength(8)
    expect(menu.querySelectorAll('[data-state-icon]')).toHaveLength(8)
    expect(menu.querySelector('[aria-checked="true"]')!.getAttribute("data-state")).toBe("in-progress")
    await click(menu.querySelector('[data-state="blocked"]'))
    expect(host.querySelector('[role="menu"][data-open]')).toBeNull()
    expect(checkbox().getAttribute("aria-checked")).toBe("mixed")
    expect(checkbox().getAttribute("aria-label")).toBe("Review: Blocked")
    expect(host.querySelector('[data-state-icon="blocked"]')).not.toBeNull()
    await click(checkbox())
    expect(checkbox().getAttribute("aria-checked")).toBe("false")
    expect(host.querySelector('[data-task-state="pending"]')).not.toBeNull()
    await click(checkbox())
    expect(checkbox().getAttribute("aria-checked")).toBe("true")
    const tip = document.getElementById(checkbox().getAttribute("aria-describedby")!)!
    expect(tip.getAttribute("role")).toBe("tooltip")
    expect(tip.textContent).toBe("Verified")
    await unmount()
  })
  it("opens the state menu on Shift+F10 itself (no contextmenu event, as on macOS), moves with the arrows and returns focus on Escape", async () => {
    const { host, unmount } = await mount(<TaskCheckbox state="pending" onValueChange={() => {}} />)
    const checkbox = host.querySelector<HTMLElement>('[role="checkbox"]')!
    await focus(checkbox)
    await press("F10", checkbox, { shiftKey: true })
    expect(document.activeElement?.getAttribute("role")).toBe("menuitemradio")
    expect(document.activeElement?.getAttribute("data-state")).toBe("pending")
    await press("ArrowDown")
    expect(document.activeElement?.getAttribute("data-state")).toBe("in-progress")
    await press("End")
    expect(document.activeElement?.getAttribute("data-state")).toBe(TASK_STATES.at(-1)!.id)
    await press("Escape")
    expect(host.querySelector('[role="menu"][data-open]')).toBeNull()
    expect(document.activeElement).toBe(checkbox)
    await unmount()
  })
  it("the context-menu key opens it too, and a browser's own contextmenu event (Windows Shift+F10) still does", async () => {
    const { host, unmount } = await mount(<TaskCheckbox state="pending" onValueChange={() => {}} />)
    const checkbox = host.querySelector<HTMLElement>('[role="checkbox"]')!
    await focus(checkbox)
    await press("ContextMenu", checkbox)
    expect(host.querySelector('[role="menu"][data-open]')).not.toBeNull()
    expect(document.activeElement?.getAttribute("role")).toBe("menuitemradio")
    await press("Escape")
    expect(document.activeElement).toBe(checkbox)
    await act(async () => { checkbox.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })) })
    await tick()
    expect(host.querySelector('[role="menu"][data-open]')).not.toBeNull()
    await press("Escape")
    await unmount()
  })
  it("opens on the current state, not the first one, from the keyboard and from a right-click", async () => {
    const { host, unmount } = await mount(<TaskCheckbox state="blocked" onValueChange={() => {}} />)
    const checkbox = host.querySelector<HTMLElement>('[role="checkbox"]')!
    await focus(checkbox)
    await press("F10", checkbox, { shiftKey: true })
    const highlighted = () => host.querySelector('[role="menuitemradio"][data-highlighted]')?.getAttribute("data-state")
    expect(document.activeElement?.getAttribute("data-state")).toBe("blocked")
    expect(highlighted()).toBe("blocked")
    await press("ArrowDown")
    expect(document.activeElement?.getAttribute("data-state")).toBe(TASK_STATES[TASK_STATES.findIndex((s) => s.id === "blocked") + 1]!.id)
    await press("Escape")
    await act(async () => { checkbox.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, button: 2, clientX: 5, clientY: 5 })) })
    await tick()
    expect(document.activeElement?.getAttribute("data-state")).toBe("blocked")
    await press("Escape")
    await unmount()
  })
  it("is read-only without onChange, and has no state menu", async () => {
    const { host, unmount } = await mount(<TaskCheckbox state="blocked" />)
    const checkbox = host.querySelector<HTMLElement>('[role="checkbox"]')!
    expect(checkbox.getAttribute("aria-readonly")).toBe("true")
    await click(checkbox)
    expect(checkbox.getAttribute("aria-checked")).toBe("mixed")
    await act(async () => { checkbox.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })) })
    expect(host.querySelector('[role="menu"]')).toBeNull()
    await unmount()
  })
})
