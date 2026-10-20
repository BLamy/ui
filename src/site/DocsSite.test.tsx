// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
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

const render = (el: React.ReactElement) => act(() => root.render(el))
const text = (sel: string) => [...host.querySelectorAll(sel)].map((n) => n.textContent?.trim())
const click = (el: Element | null) =>
  act(() => {
    el!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }))
  })

describe("DocsSite", () => {
  it("builds the sidebar from the files and opens on the home page", () => {
    render(<DocsSite files={FILES} title="Acme" routing="memory" />)
    expect(text(".ds-site-nav-group-title")).toEqual(["Guides", "Reference"])
    expect(text(".ds-site-nav-link")).toEqual(["Acme docs", "Quick start", "Theming"])
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Acme docs")
    // The page's own `# title` became the site's heading, not a second h1.
    expect(host.querySelectorAll("h1")).toHaveLength(1)
  })

  it("navigates through rewritten relative links, with breadcrumbs, lede and pager", () => {
    render(<DocsSite files={FILES} routing="memory" />)
    const link = host.querySelector<HTMLAnchorElement>(".ds-site-article [data-docstream] a")!
    expect(link.getAttribute("href")).toBe("#/guides/quick-start")
    click(link)
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Quick start")
    expect(host.querySelector(".ds-site-lede")?.textContent).toBe("Five minutes to a page.")
    expect(text(".ds-site-crumbs span")).toEqual(["Guides"])
    expect(text(".ds-site-pager-link strong")).toEqual(["Acme docs", "Theming"])
    expect(text(".ds-site-toc a")).toEqual(["Install", "Render"])
    expect(host.querySelector("#install")).not.toBeNull()

    const cross = host.querySelector<HTMLAnchorElement>(".ds-site-article [data-docstream] a")!
    expect(cross.getAttribute("href")).toBe("#/reference/theming#dark-mode")
    click(cross)
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Theming")
  })

  it("routes through the URL hash and follows back/forward", () => {
    window.history.replaceState(null, "", "/#/reference/theming")
    render(<DocsSite files={FILES} />)
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Theming")
    click(host.querySelector('.ds-site-nav-link[href="#/guides/quick-start"]'))
    expect(window.location.hash).toBe("#/guides/quick-start")
    act(() => {
      window.history.replaceState(null, "", "/#/")
      window.dispatchEvent(new HashChangeEvent("hashchange"))
    })
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Acme docs")
  })

  it("accepts old bare-hash links by slug", () => {
    window.history.replaceState(null, "", "/#theming")
    render(<DocsSite files={FILES} />)
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Theming")
  })

  it("shows a not-found page for unknown paths", () => {
    render(<DocsSite files={FILES} routing="memory" initialPath="nope" />)
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Page not found")
  })

  it("searches every page and jumps to the heading", () => {
    render(<DocsSite files={FILES} routing="memory" />)
    click(host.querySelector(".ds-site-search-btn"))
    const input = host.querySelector<HTMLInputElement>(".ds-site-search input")!
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!
      setter.call(input, "dark")
      input.dispatchEvent(new Event("input", { bubbles: true }))
    })
    const hits = text(".ds-site-search-hit-title")
    expect(hits[0]).toContain("Dark mode")
    click(host.querySelector(".ds-site-search-hit"))
    expect(host.querySelector(".ds-site-search")).toBeNull()
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Theming")
  })

  it("toggles the theme on the site in memory mode", () => {
    render(<DocsSite files={FILES} routing="memory" defaultTheme="light" themeStorageKey={false} />)
    const site = host.querySelector<HTMLElement>(".ds-site")!
    expect(site.dataset.theme).toBe("light")
    click(host.querySelector('[aria-label="Switch to dark theme"]'))
    expect(site.dataset.theme).toBe("dark")
  })

  it("lets a site embedded in a page's demo follow its own links", () => {
    const inner = { "README.md": "# Inner\n\nGo to [two](two.md).", "two.md": "# Two" }
    render(
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
    click(link)
    expect(host.querySelector(".inner .ds-site-page-title")?.textContent).toBe("Two")
    expect(host.querySelector(".ds-site-page-title")?.textContent).toBe("Acme docs")
  })
})
