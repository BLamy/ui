// @vitest-environment happy-dom
import { setPlatform } from "@ui-sdk/core/testing"
import { act } from "react"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { click, focus, mount, press, tick, type Mounted } from "../__fixtures__/dom"
import { DocsSite } from "./DocsSite"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

const FILES = {
  "docs/README.md": "# Acme docs\n\nStart with the [quick start](01-guides/01-quick-start.md).",
  "docs/01-guides/01-quick-start.md": "# Quick start\n\n## Install\n\nRun it.\n\n## Render\n\nSee it.",
  "docs/02-reference/theming.md": "# Theming\n\n## Tokens\n\nColors.\n\n## Dark mode\n\nSwitch to dark.",
}

let site: Mounted | undefined
beforeAll(() => setPlatform("other"))
beforeEach(() => window.history.replaceState(null, "", "/"))
afterEach(async () => {
  await site?.unmount()
  site = undefined
})

const open = async (ui = <DocsSite files={FILES} routing="memory" title="Acme" />) => {
  site = await mount(ui)
  return site.host
}
const button = (host: HTMLElement) => host.querySelector<HTMLElement>(".ds-site-search-btn")!
const dialog = (host: Element = document.body) => host.querySelector<HTMLElement>('[role="dialog"].ds-site-search')
const input = () => dialog()!.querySelector<HTMLInputElement>('[role="combobox"]')!
const options = () => [...dialog()!.querySelectorAll<HTMLElement>('[role="option"]:not([hidden])')]
const titles = () => options().map((o) => o.querySelector(".ds-site-search-hit-title")?.textContent)
const highlighted = () => options().filter((o) => o.hasAttribute("data-highlighted"))
const pageTitle = (host: HTMLElement) => host.querySelector(".ds-site-page-title")?.textContent
const type = async (value: string) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input(), value)
    input().dispatchEvent(new Event("input", { bubbles: true }))
  })
  await tick()
}
const keydown = async (init: KeyboardEventInit, target: EventTarget = document.body) => {
  await act(async () => void target.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init })))
  await tick()
}

describe("search", () => {
  it("opens from its button as a dialog with the field focused and the first pages listed", async () => {
    const host = await open()
    expect(button(host).getAttribute("aria-label")).toBe("Search documentation")
    expect(button(host).getAttribute("aria-haspopup")).toBe("dialog")
    expect(button(host).getAttribute("aria-keyshortcuts")).toBe("Control+K")
    expect(dialog()).toBeNull()
    await click(button(host))
    expect(dialog()!.getAttribute("aria-label")).toBe("Search documentation")
    // Embedded (memory routing), it traps focus but leaves the host page usable: see embedded-overlays.test.tsx.
    expect(dialog()!.hasAttribute("aria-modal")).toBe(false)
    // It renders inside the site, so it keeps the site's theme and tokens.
    expect(dialog()!.closest(".ds-site")).toBe(host.querySelector(".ds-site"))
    expect(document.activeElement).toBe(input())
    expect(input().getAttribute("aria-label")).toBe("Search documentation")
    const list = dialog()!.querySelector('[role="listbox"]')!
    expect(list.getAttribute("aria-label")).toBe("Pages")
    expect(input().getAttribute("aria-controls")).toBe(list.id)
    expect(titles()).toEqual(["Acme docs", "Quick start", "Theming"])
    // The first one is highlighted, and the field points at it.
    expect(highlighted()).toEqual([options()[0]])
    expect(input().getAttribute("aria-activedescendant")).toBe(options()[0]!.id)
    expect(options()[0]!.getAttribute("aria-selected")).toBe("true")
  })

  it("lists what the index finds as links, and arrows move the highlight while focus stays in the field", async () => {
    const host = await open()
    await click(button(host))
    await type("dark")
    expect(dialog()!.querySelector('[role="listbox"]')!.getAttribute("aria-label")).toBe("Results")
    expect(titles()[0]).toContain("Dark mode")
    expect(options()[0]!.getAttribute("href")).toBe("#/reference/theming#dark-mode")
    expect(options()[0]!.querySelector("mark")?.textContent?.toLowerCase()).toBe("dark")
    expect(highlighted()).toEqual([options()[0]])
    // A match in a section's text lists its heading: the index decides what shows, not the hit's own words.
    await type("colors")
    expect(titles()[0]).toContain("Tokens")
    await type("t")
    expect(options().length).toBeGreaterThan(1)
    await press("ArrowDown")
    expect(highlighted()).toEqual([options()[1]])
    expect(input().getAttribute("aria-activedescendant")).toBe(options()[1]!.id)
    expect(document.activeElement).toBe(input())
    await press("ArrowUp")
    expect(highlighted()).toEqual([options()[0]])
  })

  it("Enter follows the highlighted hit to its heading, closes, and gives focus back to the button", async () => {
    const host = await open()
    await click(button(host))
    await type("dark")
    await press("Enter")
    expect(dialog()).toBeNull()
    expect(pageTitle(host)).toBe("Theming")
    expect(document.activeElement).toBe(button(host))
  })

  it("a press on a hit goes there; a modified press is left to the browser", async () => {
    const host = await open()
    await click(button(host))
    const hit = options()[1]!
    const modified = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true })
    await act(async () => void hit.dispatchEvent(modified))
    expect(pageTitle(host)).toBe("Acme docs")
    expect(dialog()).not.toBeNull()
    await click(options()[1])
    expect(dialog()).toBeNull()
    expect(pageTitle(host)).toBe("Quick start")
  })

  it("says when nothing matches", async () => {
    const host = await open()
    await click(button(host))
    const status = dialog()!.querySelector('[role="status"]')!
    expect(status.textContent).toBe("")
    await type("zzzz")
    expect(options()).toEqual([])
    expect(status.textContent).toBe("No results for “zzzz”")
  })

  it("Escape clears what was typed, then closes and gives focus back", async () => {
    const host = await open()
    await focus(button(host))
    await press("Enter")
    expect(document.activeElement).toBe(input())
    await type("dark")
    await press("Escape")
    expect(dialog()).not.toBeNull()
    expect(input().value).toBe("")
    await press("Escape")
    expect(dialog()).toBeNull()
    expect(document.activeElement).toBe(button(host))
  })

  it("starts empty every time it opens", async () => {
    const host = await open()
    await click(button(host))
    await type("dark")
    await press("Enter")
    await click(button(host))
    expect(input().value).toBe("")
    expect(titles()).toEqual(["Acme docs", "Quick start", "Theming"])
  })

  it("can be turned off", async () => {
    const host = await open(<DocsSite files={FILES} routing="memory" search={false} />)
    expect(button(host)).toBeNull()
    await keydown({ key: "k", ctrlKey: true })
    expect(dialog()).toBeNull()
  })
})

describe("search shortcuts", () => {
  it("Ctrl+K opens it from anywhere on the page, also from a text field, and closes it again", async () => {
    const host = await open(<DocsSite files={FILES} />)
    await keydown({ key: "k", ctrlKey: true })
    expect(dialog()).not.toBeNull()
    expect(document.activeElement).toBe(input())
    await keydown({ key: "k", ctrlKey: true }, input())
    expect(dialog()).toBeNull()
    expect(pageTitle(host)).toBe("Acme docs")
  })

  it("/ opens it, but not while typing", async () => {
    await open(<><input aria-label="Elsewhere" /><DocsSite files={FILES} /></>)
    const field = document.querySelector<HTMLInputElement>('[aria-label="Elsewhere"]')!
    await focus(field)
    await keydown({ key: "/" }, field)
    expect(dialog()).toBeNull()
    await act(async () => field.blur())
    await keydown({ key: "/" })
    expect(dialog()).not.toBeNull()
  })

  it("an embedded site answers Ctrl+K only while focus is inside it, and never /", async () => {
    const host = await open()
    await keydown({ key: "k", ctrlKey: true })
    await keydown({ key: "/" })
    expect(dialog()).toBeNull()
    const inside = host.querySelector<HTMLElement>(".ds-site-brand")!
    await focus(inside)
    await keydown({ key: "/" }, inside)
    expect(dialog()).toBeNull()
    await keydown({ key: "k", ctrlKey: true }, inside)
    expect(dialog()).not.toBeNull()
  })

  it("two sites on one page register their shortcuts without clashing", async () => {
    // Strict mode turns UI SDK's duplicate-shortcut warning into an error.
    const host = await open(<><DocsSite files={FILES} className="one" /><DocsSite files={FILES} className="two" /></>)
    await keydown({ key: "k", ctrlKey: true })
    expect(host.querySelectorAll('[role="dialog"].ds-site-search')).toHaveLength(1)
  })

  it("a site leaves Ctrl+K to a site nested in it that has focus", async () => {
    const inner = { "README.md": "# Inner\n\nHello." }
    const host = await open(
      <DocsSite
        files={FILES}
        renderPage={(_, content) => (
          <>
            {content}
            <div className="docs-demo">
              <DocsSite files={inner} routing="memory" className="inner" />
            </div>
          </>
        )}
      />,
    )
    const nested = host.querySelector<HTMLElement>(".inner")!
    const inside = nested.querySelector<HTMLElement>(".ds-site-search-btn")!
    await focus(inside)
    await keydown({ key: "k", ctrlKey: true }, inside)
    expect(dialog(nested)).not.toBeNull()
    expect(document.querySelectorAll('[role="dialog"].ds-site-search')).toHaveLength(1)
  })
})
