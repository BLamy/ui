// @vitest-environment happy-dom
import { act } from "react"
import { afterEach, describe, expect, it } from "vitest"
import { click, focus, mount, press, type Mounted } from "../__fixtures__/dom"
import { DocsSite } from "./DocsSite"
import { navCurrent, navNodes, navOpenFor, navTreeItems } from "./nav"
import { buildDocsTree } from "./tree"

declare global {
  // eslint-disable-next-line no-var
  var __UI_SDK_STRICT__: boolean | undefined
}
globalThis.__UI_SDK_STRICT__ = true

const FILES = {
  "docs/README.md": "# Acme docs\n\nStart.",
  "docs/01-guides/01-quick-start.md": "# Quick start\n\nGo.",
  "docs/01-guides/02-blocks/README.md": "# Blocks\n\nAll of them.",
  "docs/01-guides/02-blocks/01-notes.md": "# Notes\n\nWrite.",
  "docs/01-guides/02-blocks/02-music.md": "# Music\n\nPlay.",
  "docs/01-guides/03-recipes/tips.md": "# Tips\n\nTry.",
  "docs/02-reference/theming.md": "# Theming\n\nColors.",
}

let site: Mounted | undefined
afterEach(async () => {
  await site?.unmount()
  site = undefined
})

const open = async (defaultPath = "") => {
  site = await mount(<DocsSite files={FILES} routing="memory" defaultPath={defaultPath} title="Acme" />)
  return site.host
}
const tree = (host: HTMLElement) => host.querySelector<HTMLElement>('.ds-site-sidebar [role="tree"]')!
const rows = (host: HTMLElement) => [...tree(host).querySelectorAll<HTMLElement>('[role="treeitem"]')]
const row = (host: HTMLElement, name: string) => rows(host).find((r) => r.querySelector(".ds-site-nav-label")?.textContent === name)!
const names = (host: HTMLElement) => rows(host).map((r) => r.querySelector(".ds-site-nav-label")?.textContent)
const focused = () => document.activeElement?.querySelector(".ds-site-nav-label")?.textContent
const title = (host: HTMLElement) => host.querySelector(".ds-site-page-title")?.textContent

describe("the sidebar's shape", () => {
  const nodes = navNodes(buildDocsTree(FILES).nav)

  it("gives every item a value of its own, and pages theirs by slug", () => {
    const values: string[] = []
    const walk = (list: typeof nodes) => list.forEach((n) => { values.push(n.value); walk(n.children) })
    walk(nodes)
    expect(new Set(values).size).toBe(values.length)
    expect(navCurrent(nodes, "guides/blocks/notes")).toBe("page:guides/blocks/notes")
    expect(navCurrent(nodes, "nowhere")).toBeNull()
  })

  it("lists the tree without its groups, with each page's link", () => {
    const items = navTreeItems(nodes, (slug) => `#/${slug}`)
    expect(items.map((i) => i.label)).toEqual(["Acme docs", "Quick start", "Blocks", "Recipes", "Theming"])
    expect(items[2]).toMatchObject({ href: "#/guides/blocks", children: [{ label: "Notes" }, { label: "Music" }] })
    expect(items[3]!.href).toBeUndefined()
  })

  it("opens the sections around a page, and the page's own", () => {
    expect(navOpenFor(nodes, "guides/blocks/notes")).toEqual(["page:guides/blocks"])
    expect(navOpenFor(nodes, "guides/blocks")).toEqual(["page:guides/blocks"])
    expect(navOpenFor(nodes, "guides/recipes/tips")).toHaveLength(1)
    expect(navOpenFor(nodes, "")).toEqual([])
  })
})

describe("the sidebar tree", () => {
  it("is a named tree of links with one tab stop, on the page being read", async () => {
    const host = await open("guides/blocks/notes")
    expect(tree(host).getAttribute("aria-label")).toBe("Pages")
    expect(tree(host).closest("nav")?.getAttribute("aria-label")).toBe("Documentation")
    expect(names(host)).toEqual(["Acme docs", "Quick start", "Blocks", "Notes", "Music", "Recipes", "Theming"])
    expect(rows(host).filter((r) => r.tabIndex === 0).map((r) => r.querySelector(".ds-site-nav-label")?.textContent)).toEqual(["Notes"])
    expect(row(host, "Notes").getAttribute("aria-current")).toBe("page")
    expect(rows(host).filter((r) => r.hasAttribute("aria-current"))).toHaveLength(1)
    expect(row(host, "Notes").querySelector(".ds-site-nav-link")?.hasAttribute("data-current")).toBe(true)
    // The section around it is open; the other one is closed, and a leaf says nothing about expanding.
    expect(row(host, "Blocks").getAttribute("aria-expanded")).toBe("true")
    expect(row(host, "Recipes").getAttribute("aria-expanded")).toBe("false")
    expect(row(host, "Theming").hasAttribute("aria-expanded")).toBe(false)
    expect(row(host, "Notes").getAttribute("aria-level")).toBe("2")
    // Pages are real links; a folder is not.
    expect(row(host, "Notes").querySelector("a")?.getAttribute("href")).toBe("#/guides/blocks/notes")
    expect(row(host, "Recipes").querySelector("a")).toBeNull()
    // Groups are named by their titles.
    const groups = [...tree(host).querySelectorAll<HTMLElement>(".ds-site-nav-group")]
    expect(groups.map((g) => document.getElementById(g.getAttribute("aria-labelledby")!)?.textContent)).toEqual(["Guides", "Reference"])
  })

  it("moves between the rows with the arrow keys, Home and End, and by typing", async () => {
    const host = await open("guides/blocks/notes")
    await focus(row(host, "Notes"))
    await press("ArrowDown")
    expect(focused()).toBe("Music")
    await press("ArrowDown")
    expect(focused()).toBe("Recipes")
    await press("ArrowUp")
    await press("ArrowUp")
    expect(focused()).toBe("Notes")
    await press("Home")
    expect(focused()).toBe("Acme docs")
    await press("End")
    expect(focused()).toBe("Theming")
    await press("q")
    expect(focused()).toBe("Quick start")
    // Moving focus doesn't navigate.
    expect(title(host)).toBe("Notes")
    expect(rows(host).filter((r) => r.tabIndex === 0)).toHaveLength(1)
  })

  it("opens and closes a section with Right and Left", async () => {
    const host = await open("guides/quick-start")
    await focus(row(host, "Recipes"))
    expect(names(host)).not.toContain("Tips")
    await press("ArrowRight")
    expect(row(host, "Recipes").getAttribute("aria-expanded")).toBe("true")
    expect(names(host)).toContain("Tips")
    await press("ArrowRight")
    expect(focused()).toBe("Tips")
    await press("ArrowLeft")
    expect(focused()).toBe("Recipes")
    await press("ArrowLeft")
    expect(row(host, "Recipes").getAttribute("aria-expanded")).toBe("false")
    expect(names(host)).not.toContain("Tips")
  })

  it("Enter on a page goes there, and opens the pages under it", async () => {
    const host = await open("")
    expect(row(host, "Blocks").getAttribute("aria-expanded")).toBe("false")
    await focus(row(host, "Blocks"))
    await press("Enter")
    expect(title(host)).toBe("Blocks")
    expect(row(host, "Blocks").getAttribute("aria-current")).toBe("page")
    expect(row(host, "Blocks").getAttribute("aria-expanded")).toBe("true")
    expect(names(host)).toContain("Notes")
    // Again leaves it open: only its chevron or Left closes it. Closed, going there opens it again.
    await press("Enter")
    expect(row(host, "Blocks").getAttribute("aria-expanded")).toBe("true")
    await press("ArrowLeft")
    expect(row(host, "Blocks").getAttribute("aria-expanded")).toBe("false")
    await press("Enter")
    expect(row(host, "Blocks").getAttribute("aria-expanded")).toBe("true")
  })

  it("Enter or a press on a folder opens and closes it, without going anywhere", async () => {
    const host = await open("")
    await focus(row(host, "Recipes"))
    await press("Enter")
    expect(row(host, "Recipes").getAttribute("aria-expanded")).toBe("true")
    await click(row(host, "Recipes").querySelector(".ds-site-nav-link"))
    expect(row(host, "Recipes").getAttribute("aria-expanded")).toBe("false")
    expect(title(host)).toBe("Acme docs")
  })

  it("a page's chevron closes its section without following the link", async () => {
    const host = await open("guides/blocks/notes")
    const chevron = row(host, "Blocks").querySelector<HTMLElement>(".ds-site-nav-toggle")!
    expect(chevron.getAttribute("aria-hidden")).toBe("true")
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    await act(async () => void chevron.dispatchEvent(event))
    expect(event.defaultPrevented).toBe(true)
    expect(row(host, "Blocks").getAttribute("aria-expanded")).toBe("false")
    expect(title(host)).toBe("Notes")
  })

  it("a click on a page's link goes there in place; a modified click is left to the browser", async () => {
    const host = await open("")
    const link = row(host, "Theming").querySelector("a")!
    const modified = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, metaKey: true })
    await act(async () => void link.dispatchEvent(modified))
    expect(modified.defaultPrevented).toBe(false)
    expect(title(host)).toBe("Acme docs")
    const plain = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    await act(async () => void link.dispatchEvent(plain))
    expect(plain.defaultPrevented).toBe(true)
    expect(title(host)).toBe("Theming")
    expect(row(host, "Theming").getAttribute("aria-current")).toBe("page")
  })

  it("a navigation from elsewhere moves the current page and opens the sections around it", async () => {
    const host = await open("guides/quick-start")
    expect(names(host)).not.toContain("Notes")
    const next = () => click(host.querySelector('.ds-site-pager-link[data-dir="next"]'))
    await next()
    // A page with pages under it shows them once it's the one being read.
    expect(title(host)).toBe("Blocks")
    expect(row(host, "Blocks").getAttribute("aria-current")).toBe("page")
    expect(row(host, "Blocks").tabIndex).toBe(0)
    expect(row(host, "Blocks").getAttribute("aria-expanded")).toBe("true")
    // Closed by hand, its section opens again when a page inside it is read.
    await click(row(host, "Blocks").querySelector(".ds-site-nav-toggle"))
    expect(names(host)).not.toContain("Notes")
    await next()
    expect(title(host)).toBe("Notes")
    expect(row(host, "Blocks").getAttribute("aria-expanded")).toBe("true")
    expect(row(host, "Notes").getAttribute("aria-current")).toBe("page")
    expect(rows(host).filter((r) => r.hasAttribute("aria-current"))).toHaveLength(1)
  })

  it("keeps an external link a link in a new tab", async () => {
    await site?.unmount()
    const files = { "SUMMARY.md": "* [Intro](README.md)\n* [GitHub](https://github.com/acme/docs)\n", "README.md": "# Intro\n\nHi." }
    site = await mount(<DocsSite files={files} routing="memory" />)
    const link = row(site.host, "GitHub").querySelector("a")!
    expect(link.getAttribute("href")).toBe("https://github.com/acme/docs")
    expect(link.target).toBe("_blank")
    expect(link.rel).toBe("noreferrer")
    const event = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 })
    link.addEventListener("click", (e) => e.preventDefault(), { once: true })
    await act(async () => void link.dispatchEvent(event))
    expect(title(site.host)).toBe("Intro")
  })
})
