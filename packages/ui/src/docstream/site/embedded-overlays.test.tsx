// @vitest-environment happy-dom
/* A site embedded in another page (memory routing) keeps its search and drawer to itself: they trap focus, but the host
   page is not made inert, dimmed or scroll-locked, and they are sized to the site's box. A site that is the page
   (hash or history routing) keeps them modal over the window. */
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { click, mount, press, tick, type Mounted } from "../__fixtures__/dom"
import { DocsSite, type DocsSiteRouting } from "./DocsSite"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

const FILES = { "docs/README.md": "# Acme docs\n\nStart.", "docs/01-guides/01-quick-start.md": "# Quick start\n\nGo." }

let site: Mounted | undefined
let hostPage: HTMLElement
beforeEach(() => {
  window.history.replaceState(null, "", "/")
  hostPage = document.body.appendChild(Object.assign(document.createElement("main"), { innerHTML: "<button>Host button</button>" }))
})
afterEach(async () => {
  await site?.unmount()
  site = undefined
  hostPage.remove()
})

const open = async (routing: DocsSiteRouting) => {
  site = await mount(<DocsSite files={FILES} routing={routing} title="Acme" appearanceStorageKey={false} documentTitle={false} applyAppearanceTo="site" />)
  return site.host.querySelector<HTMLElement>(".ds-site")!
}
const locked = () => document.documentElement.style.overflow === "hidden" || document.body.style.overflow === "hidden"

describe.each([
  ["search", ".ds-site-search-btn", '[role="dialog"].ds-site-search'],
  ["navigation drawer", ".ds-site-menu", '[role="dialog"].ds-site-drawer'],
])("the %s", (_, trigger, popup) => {
  it("embedded: traps focus inside the site's box and leaves the host page usable", async () => {
    const root = await open("memory")
    expect(root.hasAttribute("data-embedded")).toBe(true)
    await click(root.querySelector(trigger))
    const dialog = document.querySelector<HTMLElement>(popup)!
    expect(dialog).not.toBeNull()
    expect(dialog.hasAttribute("aria-modal")).toBe(false)
    expect(hostPage.inert).toBe(false)
    expect(locked()).toBe(false)
    // The overlays read the site's box.
    expect(root.style.getPropertyValue("--ds-site-frame-width")).toMatch(/px$/)
    expect(root.style.getPropertyValue("--ds-site-frame-height")).toMatch(/px$/)
    // Focus stays in it: Tab wraps inside.
    expect(dialog.contains(document.activeElement)).toBe(true)
    await press("Escape")
    await tick(20)
    expect(document.querySelector(popup)).toBeNull()
    expect(root.style.getPropertyValue("--ds-site-frame-width")).toBe("")
  })

  it("a site that is the page: modal over the window, the rest inert and the scroll locked", async () => {
    const root = await open("hash")
    expect(root.hasAttribute("data-embedded")).toBe(false)
    await click(root.querySelector(trigger))
    const dialog = document.querySelector<HTMLElement>(popup)!
    expect(dialog.getAttribute("aria-modal")).toBe("true")
    expect(hostPage.inert).toBe(true)
    expect(locked()).toBe(true)
    expect(root.style.getPropertyValue("--ds-site-frame-width")).toBe("")
    await press("Escape")
    await tick(20)
    expect(hostPage.inert).toBe(false)
  })
})
