// @vitest-environment happy-dom
/* A site under a host page's own bar: `header={false}` leaves the site's header out, and a controller connects the
   two controls only that header had, written in the host's bar, to the site: DocsSiteSearchTrigger and
   DocsSiteNavigationTrigger. A site on its own keeps its header (the other test files here cover it). */
import { setPlatform } from "@ui-sdk/core/testing"
import { act, useState } from "react"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { click, focus, mount, press, tick, type Mounted } from "../__fixtures__/dom"
import { DocsSite, DocsSiteNavigationTrigger, DocsSiteSearchTrigger, createDocsSiteController, type DocsSiteController, type DocsSiteProps } from "./DocsSite"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

const FILES = {
  "docs/README.md": "# Acme docs\n\nStart.",
  "docs/01-guides/01-quick-start.md": "# Quick start\n\n## Install\n\nRun it.\n\n## Render\n\nSee it.",
  "docs/02-reference/theming.md": "# Theming\n\n## Dark mode\n\nSwitch to dark.",
}
const TABS = [{ title: "Docs", path: "" }, { title: "Reference", path: "reference" }]

let site: Mounted | undefined
let narrow: HTMLStyleElement | undefined
beforeAll(() => setPlatform("other"))
beforeEach(() => window.history.replaceState(null, "", "/"))
afterEach(async () => {
  await site?.unmount()
  site = undefined
  narrow?.remove()
  narrow = undefined
})

/** What the site's stylesheet does to a narrow site (a container query): the sidebar folds away. */
const foldSidebar = () => {
  narrow = document.head.appendChild(Object.assign(document.createElement("style"), { textContent: ".ds-site-sidebar { display: none }" }))
}

/** A host page: its own bar with the site's two triggers, over a site without a header. */
function Host({ controller, mounted = true, ...props }: Partial<DocsSiteProps> & { controller: DocsSiteController; mounted?: boolean }) {
  return (
    <div>
      <header className="host-bar">
        <DocsSiteNavigationTrigger controller={controller} className="host-nav" />
        <DocsSiteSearchTrigger controller={controller} className="host-search" />
      </header>
      {mounted ? <DocsSite files={FILES} routing="memory" title="Acme" header={false} controller={controller} {...props} /> : null}
    </div>
  )
}

const open = async (ui: React.ReactElement) => {
  site = await mount(ui)
  return site.host
}
const root = (host: HTMLElement) => host.querySelector<HTMLElement>(".ds-site")!
const hostSearch = (host: HTMLElement) => host.querySelector<HTMLElement>(".host-search")!
const hostNav = (host: HTMLElement) => host.querySelector<HTMLElement>(".host-nav")
const searchDialog = () => document.querySelector<HTMLElement>('[role="dialog"].ds-site-search')
const drawer = () => document.querySelector<HTMLElement>('[role="dialog"].ds-site-drawer')
const pageTitle = (host: HTMLElement) => host.querySelector(".ds-site-page-title")?.textContent
const keydown = async (init: KeyboardEventInit, target: EventTarget = document.body) => {
  await act(async () => void target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })))
  await tick()
}

describe("header={false}", () => {
  it("leaves the site's header out, and nothing else", async () => {
    const host = await open(<DocsSite files={FILES} routing="memory" title="Acme" header={false} links={[{ label: "GitHub", href: "https://example.com" }]} tabs={TABS} />)
    expect(host.querySelector("header")).toBeNull()
    expect(host.querySelector(".ds-site-header")).toBeNull()
    expect(host.querySelector(".ds-site-search-btn, .ds-site-menu, .ds-site-links, .ds-site-tabs-header")).toBeNull()
    expect(root(host).hasAttribute("data-headerless")).toBe(true)
    // The site starts at its sidebar and page.
    expect(root(host).firstElementChild?.className).toBe("ds-site-body")
    expect(host.querySelector('nav.ds-site-sidebar[aria-label="Documentation"]')).not.toBeNull()
    expect(pageTitle(host)).toBe("Acme docs")
    // Tabs still scope the sidebar.
    expect([...host.querySelectorAll(".ds-site-sidebar .ds-site-nav-label")].map((n) => n.textContent)).toEqual(["Acme docs", "Quick start"])
  })

  it("is not the default: a site on its own draws its header", async () => {
    const host = await open(<DocsSite files={FILES} routing="memory" title="Acme" />)
    expect(host.querySelector("header.ds-site-header")).not.toBeNull()
    expect(root(host).hasAttribute("data-headerless")).toBe(false)
  })

  it("keeps ⌘K: the site still answers its shortcut", async () => {
    const host = await open(<DocsSite files={FILES} header={false} appearanceStorageKey={false} documentTitle={false} applyAppearanceTo="site" />)
    expect(searchDialog()).toBeNull()
    await keydown({ key: "k", ctrlKey: true })
    expect(searchDialog()).not.toBeNull()
    expect(searchDialog()!.closest(".ds-site")).toBe(root(host))
    await press("Escape")
    await tick(20)
    expect(searchDialog()).toBeNull()
  })
})

describe("DocsSiteSearchTrigger", () => {
  it("opens the site's search from the host's bar, and gets focus back when it closes", async () => {
    const controller = createDocsSiteController()
    const host = await open(<Host controller={controller} />)
    const button = hostSearch(host)
    expect(button.closest(".ds-site")).toBeNull()
    expect(button.tagName).toBe("BUTTON")
    expect(button.getAttribute("aria-label")).toBe("Search documentation")
    expect(button.getAttribute("aria-keyshortcuts")).toBe("Control+K")
    expect(button.getAttribute("aria-haspopup")).toBe("dialog")
    expect(button.getAttribute("aria-expanded")).toBe("false")
    // Its default content: a glyph, the label and the shortcut.
    expect(button.querySelector(".ds-site-search-btn-label")?.textContent).toBe("Search…")
    expect(button.querySelector("kbd")?.textContent).toContain("Ctrl+K")

    await focus(button)
    await press("Enter")
    expect(searchDialog()).not.toBeNull()
    expect(button.getAttribute("aria-expanded")).toBe("true")
    // The dialog is the site's: it renders inside it, with its theme and tokens.
    expect(searchDialog()!.closest(".ds-site")).toBe(root(host))
    expect(document.activeElement).toBe(searchDialog()!.querySelector('[role="combobox"]'))
    await press("Escape")
    await tick(20)
    expect(searchDialog()).toBeNull()
    expect(document.activeElement).toBe(button)
  })

  it("takes its own content and element", async () => {
    const controller = createDocsSiteController()
    const host = await open(
      <div>
        <DocsSiteSearchTrigger controller={controller} aria-label="Search Acme" render={<button type="button" className="mine" />}>Find</DocsSiteSearchTrigger>
        <DocsSite files={FILES} routing="memory" header={false} controller={controller} />
      </div>,
    )
    const button = host.querySelector<HTMLElement>(".mine")!
    expect(button.textContent).toBe("Find")
    expect(button.getAttribute("aria-label")).toBe("Search Acme")
    await click(button)
    expect(searchDialog()).not.toBeNull()
  })

  it("is a plain button until its site mounts, and connects when it does", async () => {
    const controller = createDocsSiteController()
    const host = await open(<Host controller={controller} mounted={false} />)
    expect(hostSearch(host).getAttribute("aria-label")).toBe("Search documentation")
    expect(hostSearch(host).hasAttribute("aria-haspopup")).toBe(false)
    await click(hostSearch(host))
    expect(searchDialog()).toBeNull()
    await site!.rerender(<Host controller={controller} />)
    expect(hostSearch(host).getAttribute("aria-haspopup")).toBe("dialog")
    await click(hostSearch(host))
    expect(searchDialog()).not.toBeNull()
  })

  it("is the same part the site's own header draws: both open the one dialog", async () => {
    const controller = createDocsSiteController()
    const host = await open(
      <div>
        <DocsSiteSearchTrigger controller={controller} className="host-search" />
        <DocsSite files={FILES} routing="memory" controller={controller} />
      </div>,
    )
    const own = host.querySelector<HTMLElement>(".ds-site-header .ds-site-search-btn")!
    expect(own.getAttribute("aria-label")).toBe("Search documentation")
    await click(hostSearch(host))
    expect(document.querySelectorAll('[role="dialog"].ds-site-search')).toHaveLength(1)
    await press("Escape")
    await tick(20)
    await click(own)
    expect(document.querySelectorAll('[role="dialog"].ds-site-search')).toHaveLength(1)
  })
})

describe("DocsSiteNavigationTrigger", () => {
  it("renders nothing while the site shows its sidebar, or while no site is mounted", async () => {
    const controller = createDocsSiteController()
    const host = await open(<Host controller={controller} />)
    expect(hostNav(host)).toBeNull()
    await site!.rerender(<Host controller={controller} mounted={false} />)
    expect(hostNav(host)).toBeNull()
  })

  it("appears while the sidebar is folded into the drawer, opens it, and gets focus back", async () => {
    foldSidebar()
    const controller = createDocsSiteController()
    const host = await open(<Host controller={controller} tabs={TABS} />)
    const button = hostNav(host)!
    expect(button.closest(".ds-site")).toBeNull()
    expect(button.tagName).toBe("BUTTON")
    expect(button.getAttribute("aria-label")).toBe("Open navigation")
    expect(button.getAttribute("aria-haspopup")).toBe("dialog")
    expect(drawer()).toBeNull()

    await focus(button)
    await press("Enter")
    expect(drawer()!.getAttribute("aria-label")).toBe("Navigation")
    expect(drawer()!.closest(".ds-site")).toBe(root(host))
    expect(root(host).hasAttribute("data-nav-open")).toBe(true)
    // The drawer keeps what the header no longer shows: the brand and the section tabs.
    expect(drawer()!.querySelector(".ds-site-drawer-head .ds-site-title")?.textContent).toBe("Acme")
    expect([...drawer()!.querySelectorAll(".ds-site-tabs-drawer .ds-site-tab")].map((t) => t.textContent)).toEqual(["Docs", "Reference"])
    await press("Escape")
    await tick(20)
    expect(drawer()).toBeNull()
    expect(document.activeElement).toBe(button)

    // Going to a page from it closes it, as from the site's own header.
    await click(button)
    const row = [...drawer()!.querySelectorAll<HTMLElement>('[role="treeitem"]')].find((r) => r.textContent === "Quick start")!
    await focus(row)
    await press("Enter")
    await tick(20)
    expect(pageTitle(host)).toBe("Quick start")
    expect(drawer()).toBeNull()
  })

  it("goes when its site unmounts", async () => {
    foldSidebar()
    const controller = createDocsSiteController()
    const host = await open(<Host controller={controller} />)
    expect(hostNav(host)).not.toBeNull()
    await site!.rerender(<Host controller={controller} mounted={false} />)
    expect(hostNav(host)).toBeNull()
  })

  it("follows a site that takes the controller over (a router swapping sites)", async () => {
    foldSidebar()
    const controller = createDocsSiteController()
    function Router() {
      const [which, setWhich] = useState<"a" | "b">("a")
      return (
        <div>
          <DocsSiteNavigationTrigger controller={controller} className="host-nav" />
          <button type="button" className="swap" onClick={() => setWhich("b")}>Swap</button>
          {which === "a"
            ? <DocsSite key="a" files={FILES} routing="memory" header={false} controller={controller} />
            : <DocsSite key="b" files={{ "README.md": "# Other docs" }} routing="memory" header={false} controller={controller} />}
        </div>
      )
    }
    const host = await open(<Router />)
    expect(hostNav(host)).not.toBeNull()
    await click(host.querySelector(".swap"))
    expect(pageTitle(host)).toBe("Other docs")
    await click(hostNav(host))
    expect(drawer()!.closest(".ds-site")).toBe(root(host))
    expect([...drawer()!.querySelectorAll(".ds-site-nav-label")].map((n) => n.textContent)).toEqual(["Other docs"])
  })
})

describe("createDocsSiteController", () => {
  it("opens the search and the navigation from code", async () => {
    const controller = createDocsSiteController()
    await open(<DocsSite files={FILES} routing="memory" header={false} controller={controller} />)
    await act(async () => controller.openSearch())
    await tick()
    expect(searchDialog()).not.toBeNull()
    await press("Escape")
    await tick(20)
    await act(async () => controller.openNavigation())
    await tick()
    expect(drawer()).not.toBeNull()
  })

  it("is the only thing `controller` takes", async () => {
    const fake = { openSearch: () => undefined, openNavigation: () => undefined }
    expect(() => DocsSiteNavigationTrigger({ controller: fake })).toThrow(/createDocsSiteController/)
  })
})
