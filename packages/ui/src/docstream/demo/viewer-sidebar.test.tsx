// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DemoViewer, FILES_DEFAULT_WIDTH, FILES_MIN_WIDTH, clampFilesWidth, filesMaxWidth } from "./DemoViewer"
import type { DemoFile } from "./types"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const FILES: DemoFile[] = [
  { path: "index.tsx", content: "export default () => null\n", language: "tsx" },
  { path: "components/user-panel.tsx", content: "export const panel = 1\n", language: "tsx" },
  { path: "components/avatar.tsx", content: "export const avatar = 1\n", language: "tsx" },
  { path: "lib/format.ts", content: "export const f = 1\n", language: "ts" },
]

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  vi.stubGlobal("IntersectionObserver", undefined)
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

const flush = async () => {
  for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)) })
}

async function mount(src = "blocks/discord-clone") {
  await act(async () => root.render(<DemoViewer src={src} title="T" files={FILES} />))
  await flush()
}

const crumbs = () => [...host.querySelectorAll<HTMLElement>("button.docs-demo-crumb")].map((b) => b.textContent)
const buttons = () => host.querySelectorAll<HTMLButtonElement>("button.docs-demo-crumb")
const handle = () => host.querySelector<HTMLElement>(".docs-demo-files-handle")!
const code = () => host.querySelector<HTMLElement>(".docs-demo-code")!
const menu = () => document.querySelector<HTMLElement>("[role=menu]")
const options = () => [...(menu()?.querySelectorAll<HTMLElement>("[role=menuitem]") ?? [])].map((o) => o.textContent)
const key = (el: Element, k: string, init: KeyboardEventInit = {}) =>
  act(async () => void el.dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true, ...init })))

describe("clampFilesWidth", () => {
  it("clamps to [140, 60% of the viewer]; an unmeasured viewer only enforces the minimum", () => {
    expect(clampFilesWidth(50, 800)).toBe(FILES_MIN_WIDTH)
    expect(clampFilesWidth(900, 800)).toBe(480)
    expect(clampFilesWidth(300.4, 800)).toBe(300)
    expect(clampFilesWidth(900, 0)).toBe(900)
    expect(filesMaxWidth(100)).toBe(FILES_MIN_WIDTH)
  })
})

describe("file list resize handle", () => {
  it("starts at the default and moves with the arrow keys (Shift for a bigger step), Home and End", async () => {
    await mount()
    expect(handle().getAttribute("aria-valuenow")).toBe(String(FILES_DEFAULT_WIDTH))
    expect(code().style.getPropertyValue("--docs-demo-files-w")).toBe("")
    await key(handle(), "ArrowRight")
    expect(handle().getAttribute("aria-valuenow")).toBe("198")
    expect(code().style.getPropertyValue("--docs-demo-files-w")).toBe("198px")
    await key(handle(), "ArrowLeft", { shiftKey: true })
    expect(handle().getAttribute("aria-valuenow")).toBe("148")
    await key(handle(), "Home")
    expect(handle().getAttribute("aria-valuenow")).toBe(String(FILES_MIN_WIDTH))
    await key(handle(), "ArrowLeft", { shiftKey: true })
    expect(handle().getAttribute("aria-valuenow")).toBe(String(FILES_MIN_WIDTH))
  })

  it("double-click resets to the default; the width survives switching files", async () => {
    await mount()
    await key(handle(), "ArrowRight", { shiftKey: true })
    expect(handle().getAttribute("aria-valuenow")).toBe("238")
    await act(async () => host.querySelectorAll<HTMLElement>(".docs-demo-file")[1].click())
    expect(handle().getAttribute("aria-valuenow")).toBe("238")
    expect(code().style.getPropertyValue("--docs-demo-files-w")).toBe("238px")
    await act(async () => void handle().dispatchEvent(new MouseEvent("dblclick", { bubbles: true })))
    expect(handle().getAttribute("aria-valuenow")).toBe(String(FILES_DEFAULT_WIDTH))
    expect(code().style.getPropertyValue("--docs-demo-files-w")).toBe("")
  })

  it("drags with the pointer, clamped to the viewer", async () => {
    await mount()
    vi.spyOn(code(), "getBoundingClientRect").mockReturnValue({ left: 100, width: 600, right: 700, top: 0, bottom: 0, height: 0, x: 100, y: 0, toJSON() {} })
    const down = new MouseEvent("pointerdown", { bubbles: true, cancelable: true, button: 0, clientX: 288 })
    await act(async () => void handle().dispatchEvent(down))
    expect(handle().getAttribute("data-dragging")).toBe("true")
    const move = (clientX: number) => act(async () => void window.dispatchEvent(new MouseEvent("pointermove", { clientX })))
    await move(400)
    expect(code().style.getPropertyValue("--docs-demo-files-w")).toBe("300px")
    await move(1200)
    expect(code().style.getPropertyValue("--docs-demo-files-w")).toBe("360px")
    await move(0)
    expect(code().style.getPropertyValue("--docs-demo-files-w")).toBe(`${FILES_MIN_WIDTH}px`)
    await act(async () => void window.dispatchEvent(new MouseEvent("pointerup")))
    expect(handle().getAttribute("data-dragging")).toBeNull()
  })
})

describe("breadcrumb", () => {
  it("shows src, folders and the file; folder buttons open the siblings menu with the current one marked", async () => {
    await mount()
    expect(crumbs()).toEqual(["blocks", "discord-clone", "index.tsx"])
    const [first, , last] = buttons()
    expect(last.getAttribute("aria-current")).toBe("page")
    expect(menu()).toBeNull()
    await act(async () => last.click())
    // the file segment lists the files beside it
    expect(menu()!.getAttribute("role")).toBe("menu")
    expect(options()).toEqual(["index.tsx"])
    expect(last.getAttribute("aria-expanded")).toBe("true")
    // a src segment is the demo root: it lists the root's entries (switching menus closes the first)
    await act(async () => first.click())
    expect(options()).toEqual(["components", "lib", "index.tsx"])
    expect(last.getAttribute("aria-expanded")).toBe("false")
    await act(async () => first.click())
    expect(menu()).toBeNull()
  })

  it("picking a file switches the active file; picking a folder opens its first file", async () => {
    await mount("")
    // Select a nested file via the tabs, then walk up the breadcrumb.
    await act(async () => host.querySelectorAll<HTMLElement>(".docs-demo-file")[1].click())
    expect(crumbs()).toEqual(["components", "user-panel.tsx"])
    await act(async () => buttons()[0].click())
    expect(options()).toEqual(["components", "lib", "index.tsx"])
    expect(menu()!.querySelector("[data-current]")!.textContent).toBe("components")
    await act(async () => [...menu()!.querySelectorAll<HTMLElement>("[role=menuitem]")].find((o) => o.textContent === "lib")!.click())
    expect(menu()).toBeNull()
    expect(crumbs()).toEqual(["lib", "format.ts"])
    expect(host.querySelector(".docs-demo-file[aria-selected=true]")!.textContent).toBe("format.ts")

    await act(async () => buttons()[1].click())
    expect(options()).toEqual(["format.ts"])
    await act(async () => buttons()[0].click())
    await act(async () => [...menu()!.querySelectorAll<HTMLElement>("[role=menuitem]")].find((o) => o.textContent === "components")!.click())
    expect(crumbs()).toEqual(["components", "user-panel.tsx"])
  })

  it("is keyboard operable: ArrowDown opens, arrows move, Enter picks, Escape closes and returns focus", async () => {
    await mount("")
    await act(async () => host.querySelectorAll<HTMLElement>(".docs-demo-file")[1].click())
    const trigger = buttons()[1]
    await act(async () => trigger.focus())
    await key(trigger, "ArrowDown")
    expect(options()).toEqual(["avatar.tsx", "user-panel.tsx"])
    // focus lands on the current entry
    expect(document.activeElement!.textContent).toBe("user-panel.tsx")
    await key(document.activeElement!, "ArrowUp")
    expect(document.activeElement!.textContent).toBe("avatar.tsx")
    await key(document.activeElement!, "Escape")
    expect(menu()).toBeNull()
    expect(document.activeElement).toBe(trigger)

    await key(trigger, "ArrowDown")
    await key(document.activeElement!, "ArrowUp")
    await act(async () => (document.activeElement as HTMLElement).click()) // Enter on a button is a click
    expect(menu()).toBeNull()
    expect(crumbs()).toEqual(["components", "avatar.tsx"])
  })

  it("closes on an outside pointer press", async () => {
    await mount("")
    await act(async () => buttons()[0].click())
    expect(menu()).toBeTruthy()
    await act(async () => void document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true })))
    expect(menu()).toBeNull()
  })

  it("collapses the middle into a … that lists the hidden segments when the segments don't fit", async () => {
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} })
    // 60px per breadcrumb item and a 200px header: all five (300) don't fit; first + … + last (180) do.
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function (this: HTMLElement) {
      return this.classList.contains("docs-demo-crumbs") ? 200 : 0
    })
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const w = this.classList.contains("docs-demo-crumb-item") ? 60 : 0
      return { width: w, left: 0, top: 0, right: w, bottom: 0, height: 0, x: 0, y: 0, toJSON() {} }
    })
    await act(async () => root.render(<DemoViewer src="a/b" title="T" files={FILES} />))
    await flush()
    await act(async () => host.querySelectorAll<HTMLElement>(".docs-demo-file")[1].click())
    expect(crumbs()).toEqual(["a", "…", "user-panel.tsx"])
    await act(async () => buttons()[1].click())
    expect(menu()!.getAttribute("aria-label")).toBe("Hidden path segments")
    expect(options()).toEqual(["b", "components"])
    // a hidden folder behaves like a folder picked in a sibling menu: it opens its first file
    await act(async () => [...menu()!.querySelectorAll<HTMLElement>("[role=menuitem]")].find((o) => o.textContent === "b")!.click())
    expect(host.querySelector(".docs-demo-file[aria-selected=true]")!.textContent).toBe("index.tsx")
  })
})
