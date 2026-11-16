// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { DocsSite } from "./DocsSite"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const FILES = {
  "docs/README.md": "# Acme docs\n\nStart with the [quick start](01-guides/01-quick-start.md).",
  "docs/01-guides/01-quick-start.md": "---\ndescription: Five minutes to a page.\n---\n\n# Quick start\n\n## Install\n\nRun it.\n\n## Render\n\nSee [theming](../02-reference/theming.md#dark-mode).",
  "docs/02-reference/theming.md": "# Theming\n\n## Tokens\n\nColors.\n\n## Dark mode\n\nSwitch.",
  "docs/logo.svg": "<svg/>",
}

let host: HTMLDivElement
let root: Root

beforeEach(() => {
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
  window.history.replaceState(null, "", "/")
})

afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

// UI SDK's parts settle a tick after they mount (and after a press), so rendering and clicking wait for it.
const settle = () => act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
const render = async (el: React.ReactElement) => {
  await act(async () => root.render(el))
  await settle()
}
const text = (sel: string) => [...host.querySelectorAll(sel)].map((n) => n.textContent?.trim())
const click = async (el: Element | null) => {
  await act(async () => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))
  })
  await settle()
}

describe("DocsSite", () => {
  it("puts sections in the header as tabs; the sidebar and pager stay inside the current one", async () => {
    const files = {
      "SUMMARY.md": "## Getting started\n\n* [Intro](README.md)\n* [Button](button.md)\n\n## Blocks\n\n* [Blocks](blocks/README.md)\n  * [Notes](blocks/notes.md)\n  * [Music](blocks/music.md)\n",
      "README.md": "# Intro\n\nHi.",
      "button.md": "# Button\n\nPress.",
      "blocks/README.md": "# Blocks\n\nAll of them.",
      "blocks/notes.md": "---\nlayout: wide\n---\n\n# Notes\n\nWide.",
      "blocks/music.md": "# Music\n\nPlay.",
    }
    const tabs = [{ title: "Components", path: "" }, { title: "Blocks", path: "blocks" }]
    await render(<DocsSite files={files} tabs={tabs} routing="memory" initialPath="button" />)
    const tabLinks = () => [...host.querySelectorAll(".ds-site-tabs-header .ds-site-tab")]
    expect(tabLinks().map((a) => a.textContent)).toEqual(["Components", "Blocks"])
    expect(tabLinks()[0]!.getAttribute("aria-current")).toBe("page")
    expect(text(".ds-site-sidebar .ds-site-nav-link")).toEqual(["Intro", "Button"])
    // The last Components page has no Next into Blocks.
    expect(host.querySelector('.ds-site-pager-link[data-dir="next"]')).toBeNull()

    await click(tabLinks()[1]!)
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Blocks")
    expect(tabLinks()[1]!.getAttribute("aria-current")).toBe("page")
    expect(text(".ds-site-sidebar .ds-site-nav-link")).toEqual(["Blocks", "Notes", "Music"])
    expect(host.querySelector('.ds-site-pager-link[data-dir="prev"]')).toBeNull()

    await click(host.querySelector('.ds-site-pager-link[data-dir="next"]'))
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Notes")
    expect(host.querySelector(".ds-site-columns")?.getAttribute("data-layout")).toBe("wide")
    // `layout` is site frontmatter: no property sheet for it.
    expect(host.querySelector("[data-document-properties]")).toBeNull()
  })

  it("builds the sidebar from the files and opens on the home page", async () => {
    await render(<DocsSite files={FILES} title="Acme" routing="memory" />)
    expect(text(".ds-site-nav-group-title")).toEqual(["Guides", "Reference"])
    expect(text(".ds-site-nav-link")).toEqual(["Acme docs", "Quick start", "Theming"])
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Acme docs")
    // The page's own `# title` became the site's heading, not a second h1.
    expect(host.querySelectorAll("h1")).toHaveLength(1)
  })

  it("navigates through rewritten relative links, with breadcrumbs, lede and pager", async () => {
    await render(<DocsSite files={FILES} routing="memory" />)
    const link = host.querySelector<HTMLAnchorElement>(".ds-site-article [data-docstream] a")!
    expect(link.getAttribute("href")).toBe("#/guides/quick-start")
    await click(link)
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Quick start")
    expect(host.querySelector(".ds-site-lede")?.textContent).toBe("Five minutes to a page.")
    expect(text(".ds-site-crumbs span")).toEqual(["Guides"])
    expect(text(".ds-site-pager-link strong")).toEqual(["Acme docs", "Theming"])
    expect(text(".ds-site-toc a")).toEqual(["Install", "Render"])
    expect(host.querySelector("#install")).not.toBeNull()

    const cross = host.querySelector<HTMLAnchorElement>(".ds-site-article [data-docstream] a")!
    expect(cross.getAttribute("href")).toBe("#/reference/theming#dark-mode")
    await click(cross)
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Theming")
  })

  it("routes through the URL hash and follows back/forward", async () => {
    window.history.replaceState(null, "", "/#/reference/theming")
    await render(<DocsSite files={FILES} />)
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Theming")
    await click(host.querySelector('.ds-site-nav-link[href="#/guides/quick-start"]'))
    expect(window.location.hash).toBe("#/guides/quick-start")
    act(() => {
      window.history.replaceState(null, "", "/#/")
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Acme docs")
  })

  it("accepts old bare-hash links by slug", async () => {
    window.history.replaceState(null, "", "/#theming")
    await render(<DocsSite files={FILES} />)
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Theming")
  })

  it("shows a not-found page for unknown paths", async () => {
    await render(<DocsSite files={FILES} routing="memory" initialPath="nope" />)
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Page not found")
  })

  it("searches every page and jumps to the heading", async () => {
    await render(<DocsSite files={FILES} routing="memory" />)
    await click(host.querySelector(".ds-site-search-btn"))
    const input = host.querySelector<HTMLInputElement>(".ds-site-search input")!
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(input, "dark")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    const hits = text(".ds-site-search-hit-title")
    expect(hits[0]).toContain("Dark mode")
    await click(host.querySelector(".ds-site-search-hit"))
    expect(host.querySelector(".ds-site-search")).toBeNull()
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Theming")
  })

  it("toggles the theme on the site in memory mode", async () => {
    await render(<DocsSite files={FILES} routing="memory" defaultTheme="light" themeStorageKey={false} />)
    const site = host.querySelector<HTMLElement>(".ds-site")!
    expect(site.dataset.theme).toBe("light")
    await click(host.querySelector('[aria-label="Switch to dark theme"]'))
    expect(site.dataset.theme).toBe("dark")
  })

  it("lets a site embedded in a page's demo follow its own links", async () => {
    const inner = { "README.md": "# Inner\n\nGo to [two](two.md).", "two.md": "# Two" }
    await render(
      <DocsSite
        files={FILES}
        routing="memory"
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
    const link = host.querySelector<HTMLAnchorElement>(".inner .ds-site-article [data-docstream] a")!
    expect(link.dataset.dsSlug).toBe("two")
    await click(link)
    expect(host.querySelector(".inner .ds-site-page-title")?.textContent).toBe("Two")
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Acme docs")
  })

  it("serves files from the VFS to the page: images and OpenAPI specs", async () => {
    const spec = { openapi: "3.0.0", paths: { "/pets": { get: { summary: "List pets", responses: {} } } } }
    const fetchSpy = vi.fn(async (url: string) => new Response(JSON.stringify(spec), { status: 200, headers: { "content-type": "application/json" } }))
    vi.stubGlobal("fetch", fetchSpy)
    try {
      const files = {
        "docs/README.md": "# Home",
        "docs/api/pets.md": '# Pets\n\n![logo](../img/logo.svg)\n\nGet [the spec](specs/pets.json).\n\n{% openapi-operation spec="pets" path="/pets" method="get" %}\n[pets](specs/pets.json)\n{% endopenapi-operation %}\n',
        "docs/api/specs/pets.json": JSON.stringify(spec),
        "docs/img/logo.svg": "<svg xmlns=\"http://www.w3.org/2000/svg\"/>",
      }
      await render(<DocsSite files={files} routing="memory" initialPath="api/pets" />)
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20))
      })
      expect(host.querySelector<HTMLImageElement>(".ds-site-article img")!.getAttribute("src")).toMatch(/^blob:/)
      expect(String(fetchSpy.mock.calls[0]?.[0])).toMatch(/^blob:/)
      expect(host.querySelector(".ds-site-article")!.textContent).toContain("List pets")
      const download = [...host.querySelectorAll<HTMLAnchorElement>(".ds-site-article a")].find((a) => a.textContent === "the spec")!
      expect(download.getAttribute("href")).toMatch(/^blob:/)
      expect(download.target).toBe("_blank")
    } finally {
      vi.unstubAllGlobals()
    }
  })
})
