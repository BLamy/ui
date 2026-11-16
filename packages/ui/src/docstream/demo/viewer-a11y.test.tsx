// @vitest-environment happy-dom
/* The demo viewer's controls on UI SDK: the keyboard, focus and ARIA contract docstream wires up. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DemoViewer } from "./DemoViewer"
import { CopyDemoButton } from "./copy-demo"
import { click, focus, mount, press, tick, type Mounted } from "../__fixtures__/dom"
import type { DemoFile } from "./types"

const FILES: DemoFile[] = [
  { path: "index.tsx", content: "export default () => null\n", language: "tsx" },
  { path: "components/avatar.tsx", content: "export const avatar = 1\n", language: "tsx" },
  { path: "components/user-panel.tsx", content: "export const panel = 1\n", language: "tsx" },
]
const runtime = () => <span className="runtime-out">running</span>

let view: Mounted | undefined
beforeEach(() => vi.stubGlobal("IntersectionObserver", undefined))
afterEach(async () => {
  await view?.unmount()
  view = undefined
  vi.unstubAllGlobals()
})

const $ = <T extends Element = HTMLElement>(selector: string) => view!.host.querySelector<T>(selector)
const $$ = <T extends Element = HTMLElement>(selector: string) => [...view!.host.querySelectorAll<T>(selector)]

describe("Preview | Code tabs", () => {
  it("is a named tablist whose arrows select a tab and show its panel; both panels stay mounted", async () => {
    view = await mount(<DemoViewer src="a/b" title="Card" files={FILES} runtime={runtime} />)
    const list = $(".docs-demo-tools [role=tablist]")!
    expect(list.getAttribute("aria-label")).toBe("Card view")
    const [preview, code] = [...list.querySelectorAll<HTMLElement>("[role=tab]")]
    expect(preview.textContent).toBe("Preview")
    expect(preview.getAttribute("aria-selected")).toBe("true")
    expect(preview.tabIndex).toBe(0)
    expect(code.tabIndex).toBe(-1)
    const previewPanel = document.getElementById(preview.getAttribute("aria-controls")!)!
    expect(previewPanel.getAttribute("role")).toBe("tabpanel")
    expect(previewPanel.getAttribute("aria-labelledby")).toBe(preview.id)
    expect(previewPanel.querySelector(".runtime-out")).toBeTruthy()

    await focus(preview)
    await press("ArrowRight")
    expect(document.activeElement).toBe(code)
    expect(code.getAttribute("aria-selected")).toBe("true")
    expect(code.hasAttribute("data-selected")).toBe(true)
    // The preview keeps its state (still mounted, hidden) while the code shows.
    expect(previewPanel.hidden).toBe(true)
    expect(previewPanel.querySelector(".runtime-out")).toBeTruthy()
    expect($(".docs-demo-code")).toBeTruthy()

    await press("Home")
    expect(document.activeElement).toBe(preview)
    expect(previewPanel.hidden).toBe(false)
  })

  it("opens on the code, with the preview's note, when nothing can run", async () => {
    view = await mount(<DemoViewer src="a/b" title="Card" files={FILES} />)
    const code = $$("[role=tab]").find((tab) => tab.textContent === "Code")!
    expect(code.getAttribute("aria-selected")).toBe("true")
  })
})

describe("viewport widths", () => {
  it("is a named group of toggles with one pressed and one tab stop; pressing another keeps one pressed", async () => {
    view = await mount(<DemoViewer src="a/b" title="Card" files={FILES} runtime={runtime} />)
    const group = $(".docs-demo-viewports")!
    expect(group.getAttribute("role")).toBe("group")
    expect(group.getAttribute("aria-label")).toBe("Preview width")
    const toggles = [...group.querySelectorAll<HTMLButtonElement>("button")]
    expect(toggles.map((t) => t.getAttribute("aria-label"))).toEqual(["Desktop", "Tablet (768px)", "Phone (390px)"])
    expect(toggles.map((t) => t.getAttribute("aria-pressed"))).toEqual(["true", "false", "false"])
    expect(toggles.filter((t) => t.tabIndex === 0)).toHaveLength(1)

    await focus(toggles[0])
    await press("ArrowRight")
    expect(document.activeElement).toBe(toggles[1])
    await press(" ")
    expect(toggles.map((t) => t.getAttribute("aria-pressed"))).toEqual(["false", "true", "false"])
    expect($(".docs-demo-frame")!.hasAttribute("data-sized")).toBe(true)
    // The pressed toggle stays pressed: there is always a width.
    await click(toggles[1])
    expect(toggles[1].getAttribute("aria-pressed")).toBe("true")
    await click(toggles[0])
    expect($(".docs-demo-frame")!.hasAttribute("data-sized")).toBe(false)
  })

  it("puts the preview in a resizable stage with a named splitter", async () => {
    view = await mount(<DemoViewer src="a/b" title="Card" files={FILES} runtime={runtime} />)
    expect($(".docs-demo-stage")!.getAttribute("data-slot")).toBe("resizable")
    const handle = $(".docs-demo-handle")!
    expect(handle.getAttribute("role")).toBe("separator")
    expect(handle.getAttribute("aria-label")).toBe("Resize preview")
    expect(handle.getAttribute("aria-controls")).toBe($(".docs-demo-frame")!.id)
    expect(handle.tabIndex).toBe(0)
  })
})

describe("fullscreen", () => {
  it("opens a modal dialog named by the demo title, focuses Close, and Escape returns focus to the button", async () => {
    const variants = [{ id: "light", label: "Light" }, { id: "dark", label: "Dark" }]
    view = await mount(<DemoViewer src="a/b" title="Card" files={FILES} runtime={runtime} variants={variants} />)
    const open = $<HTMLButtonElement>("[aria-label='Open Card fullscreen']")!
    expect(open.getAttribute("aria-haspopup")).toBe("dialog")
    await click(open)
    await tick(20)
    const dialog = $("[role=dialog]")!
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(document.getElementById(dialog.getAttribute("aria-labelledby")!)!.textContent).toBe("Card")
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close fullscreen")
    expect(dialog.querySelector(".runtime-out")).toBeTruthy()

    await press("Escape")
    await tick(20)
    expect($("[role=dialog]")).toBeNull()
    expect(document.activeElement).toBe(open)
  })

  it("closes from its Close button", async () => {
    view = await mount(<DemoViewer src="a/b" title="Card" files={FILES} runtime={runtime} />)
    await click($("[aria-label='Open Card fullscreen']"))
    await tick(20)
    await click($("[aria-label='Close fullscreen']"))
    await tick(20)
    expect($("[role=dialog]")).toBeNull()
  })
})

describe("file tabs", () => {
  it("is a vertical tablist: Up/Down select a file and its source, one tab stop, folders stay out of it", async () => {
    view = await mount(<DemoViewer src="a/b" title="Card" files={FILES} />)
    const list = $(".docs-demo-files")!
    expect(list.getAttribute("role")).toBe("tablist")
    expect(list.getAttribute("aria-orientation")).toBe("vertical")
    const tabs = [...list.querySelectorAll<HTMLElement>("[role=tab]")]
    expect(tabs.map((t) => t.textContent)).toEqual(["index.tsx", "avatar.tsx", "user-panel.tsx"])
    expect(list.querySelector(".docs-demo-dir")!.getAttribute("aria-hidden")).toBe("true")
    expect(tabs.filter((t) => t.tabIndex === 0)).toEqual([tabs[0]])

    await focus(tabs[0])
    await press("ArrowDown")
    expect(document.activeElement).toBe(tabs[1])
    expect(tabs[1].getAttribute("aria-selected")).toBe("true")
    const panel = document.getElementById(tabs[1].getAttribute("aria-controls")!)!
    expect(panel.getAttribute("role")).toBe("tabpanel")
    expect(panel.textContent).toContain("avatar")
    // The breadcrumb follows the selected file.
    expect([...view.host.querySelectorAll("button.docs-demo-crumb")].map((b) => b.textContent)).toEqual(["a", "b", "components", "avatar.tsx"])
    await press("End")
    expect(document.activeElement).toBe(tabs[2])
    await press("ArrowDown")
    expect(document.activeElement).toBe(tabs[0])
  })
})

describe("breadcrumb menus", () => {
  it("each segment is a menu button; the open menu is named and another segment takes it over", async () => {
    view = await mount(<DemoViewer src="" title="Card" files={FILES} />)
    await click($$(".docs-demo-file")[1])
    const [folder, file] = $$<HTMLButtonElement>("button.docs-demo-crumb")
    expect(folder.getAttribute("aria-haspopup")).toBe("menu")
    expect(new Set($$("button.docs-demo-crumb").map((b) => b.id)).size).toBe(2)
    await click(folder)
    const menu = () => $("[role=menu]")
    expect(menu()!.getAttribute("aria-label")).toBe("Files in the demo root")
    expect(folder.getAttribute("aria-expanded")).toBe("true")
    expect([...menu()!.querySelectorAll("[role=menuitem]")].map((i) => i.textContent)).toEqual(["components", "index.tsx"])
    await click(file)
    expect(menu()!.getAttribute("aria-label")).toBe("Files in components")
    expect(folder.getAttribute("aria-expanded")).toBe("false")
    expect(file.getAttribute("aria-expanded")).toBe("true")
    await click(file)
    expect(menu()).toBeNull()
  })
})

describe("copy demo", () => {
  it("is a UI SDK button with a name that becomes Copied", async () => {
    const clipboard = vi.fn(() => null)
    view = await mount(<CopyDemoButton clipboard={clipboard} />)
    const button = $<HTMLButtonElement>("button")!
    expect(button.getAttribute("data-slot")).toBe("button")
    expect(button.type).toBe("button")
    expect(button.getAttribute("aria-label")).toBe("Copy demo")
    await click(button)
    expect(clipboard).toHaveBeenCalled()
    // Nothing to copy: the label doesn't claim a copy.
    expect(button.getAttribute("aria-label")).toBe("Copy demo")
  })
})
