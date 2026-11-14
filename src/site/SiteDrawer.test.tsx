// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest"
import { click, focus, mount, press, tick, type Mounted } from "../__fixtures__/dom"
import { DocsSite } from "./DocsSite"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

const FILES = {
  "docs/README.md": "# Acme docs\n\nStart.",
  "docs/01-guides/01-quick-start.md": "# Quick start\n\nGo.",
  "docs/02-reference/theming.md": "# Theming\n\nColors.",
}
const TABS = [{ title: "Docs", path: "" }, { title: "Reference", path: "reference" }]

let site: Mounted | undefined
afterEach(async () => {
  await site?.unmount()
  site = undefined
})

const open = async (ui = <DocsSite files={FILES} routing="memory" title="Acme" defaultTheme="dark" themeStorageKey={false} />) => {
  site = await mount(ui)
  return site.host
}
const root = (host: HTMLElement) => host.querySelector<HTMLElement>(".ds-site")!
const menu = (host: HTMLElement) => host.querySelector<HTMLElement>(".ds-site-menu")!
const drawer = () => document.querySelector<HTMLElement>('[role="dialog"].ds-site-drawer')
const pageTitle = (host: HTMLElement) => host.querySelector(".ds-site-page-title")?.textContent

describe("the header's controls", () => {
  it("are all named", async () => {
    const host = await open()
    const controls = [...host.querySelectorAll<HTMLElement>(".ds-site-header button")]
    expect(controls.map((b) => b.getAttribute("aria-label"))).toEqual(["Open navigation", "Search documentation", "Switch to light theme"])
    expect(menu(host).getAttribute("aria-haspopup")).toBe("dialog")
    expect(menu(host).hasAttribute("aria-disabled")).toBe(false)
  })
})

describe("the phone navigation drawer", () => {
  it("opens from the menu button as a modal dialog inside the site, with focus on its close button", async () => {
    const host = await open()
    expect(drawer()).toBeNull()
    expect(root(host).hasAttribute("data-nav-open")).toBe(false)
    await click(menu(host))
    expect(drawer()!.getAttribute("aria-label")).toBe("Navigation")
    expect(drawer()!.getAttribute("aria-modal")).toBe("true")
    expect(drawer()!.getAttribute("data-side")).toBe("left")
    expect(root(host).hasAttribute("data-nav-open")).toBe(true)
    // Rendered in place: the theme and palette on the site's root reach it.
    expect(drawer()!.closest(".ds-site")).toBe(root(host))
    expect(root(host).dataset.theme).toBe("dark")
    expect(root(host).hasAttribute("data-palette")).toBe(true)
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Close navigation")
    // It holds the same tree as the sidebar, in a named landmark.
    const nav = drawer()!.querySelector("nav.ds-site-sidebar-scroll")!
    expect(nav.getAttribute("aria-label")).toBe("Documentation")
    expect([...nav.querySelectorAll('[role="treeitem"] .ds-site-nav-label')].map((n) => n.textContent)).toEqual(["Acme docs", "Quick start", "Theming"])
  })

  it("Escape closes it and gives focus back to the menu button", async () => {
    const host = await open()
    await focus(menu(host))
    await press("Enter")
    expect(drawer()).not.toBeNull()
    await press("Escape")
    await tick(20)
    expect(drawer()).toBeNull()
    expect(root(host).hasAttribute("data-nav-open")).toBe(false)
    expect(document.activeElement).toBe(menu(host))
  })

  it("its close button closes it", async () => {
    const host = await open()
    await click(menu(host))
    await press("Enter")
    await tick(20)
    expect(drawer()).toBeNull()
    expect(document.activeElement).toBe(menu(host))
  })

  it("going to a page from it closes it", async () => {
    const host = await open()
    await click(menu(host))
    const row = [...drawer()!.querySelectorAll<HTMLElement>('[role="treeitem"]')].find((r) => r.textContent === "Theming")!
    await focus(row)
    await press("Enter")
    await tick(20)
    expect(pageTitle(host)).toBe("Theming")
    expect(drawer()).toBeNull()
    expect(root(host).hasAttribute("data-nav-open")).toBe(false)
  })

  it("carries the section tabs, as links", async () => {
    const host = await open(<DocsSite files={FILES} routing="memory" tabs={TABS} />)
    await click(menu(host))
    const tabs = [...drawer()!.querySelectorAll<HTMLAnchorElement>(".ds-site-tabs-drawer .ds-site-tab")]
    expect(tabs.map((t) => t.textContent)).toEqual(["Docs", "Reference"])
    expect(tabs[0]!.getAttribute("aria-current")).toBe("page")
    await click(tabs[1])
    await tick(20)
    expect(pageTitle(host)).toBe("Theming")
    expect(drawer()).toBeNull()
  })
})
