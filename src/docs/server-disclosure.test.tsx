// @vitest-environment happy-dom
/* A readonly renderer degrades: server HTML (no script, or before hydration) shows expandables and the property sheet
   as native <details>, which open and are found in the page without JavaScript. Hydrated, they are UI SDK's
   Collapsible again (the 2.0 keyboard and ARIA contract), and what the reader opened before the script ran stays open. */
import { act } from "react"
import { hydrateRoot } from "react-dom/client"
import { renderToString } from "react-dom/server"
import { afterEach, describe, expect, it, vi } from "vitest"
import { parseMarkdown } from "../gitbook/parse"
import "../__fixtures__/dom"
import { MarkdownContent } from "./DocsRenderer"
import { DocumentProperties } from "./DocumentProperties"

const EXPANDABLE = "<details>\n<summary>More</summary>\n\nHidden text\n\n</details>\n"
const properties = parseMarkdown('---\ntitle: "Note"\npriority: 4\n---\n\nBody\n').properties!

const parse = (html: string) => {
  const host = document.createElement("div")
  host.innerHTML = html
  return host
}

let cleanup: (() => void) | undefined
afterEach(() => {
  cleanup?.()
  cleanup = undefined
})

describe("server-rendered disclosures (no hydration)", () => {
  it("an expandable is a native <details>: its summary opens it and its text is not hidden from find-in-page", () => {
    const host = parse(renderToString(<MarkdownContent markdown={EXPANDABLE} />))
    const details = host.querySelector("details.docs-expandable")!
    expect(details).not.toBeNull()
    expect(details.hasAttribute("open")).toBe(false)
    const summary = details.querySelector(":scope > summary.docs-expandable-trigger")!
    expect(summary.textContent).toContain("More")
    const body = details.querySelector(":scope > .docs-expandable-body")!
    expect(body.textContent).toContain("Hidden text")
    // Nothing script-dependent: no `hidden`, no button that needs a handler to open it.
    expect(details.querySelector("[hidden]")).toBeNull()
    expect(details.querySelector("button")).toBeNull()
  })

  it("the property sheet is a native <details>, open when asked, with its rows in the HTML", () => {
    const closed = parse(renderToString(<DocumentProperties properties={properties} />))
    const details = closed.querySelector("details.docs-document-properties[data-document-properties]")!
    expect(details).not.toBeNull()
    expect(details.hasAttribute("open")).toBe(false)
    expect(details.querySelector(":scope > summary.docs-properties-trigger")!.textContent).toContain("Properties")
    expect(details.querySelector(".docs-properties-panel")!.textContent).toContain("priority")
    expect(details.querySelector("[hidden]")).toBeNull()
    const open = parse(renderToString(<DocumentProperties properties={properties} defaultOpen />))
    expect(open.querySelector("details.docs-document-properties")!.hasAttribute("open")).toBe(true)
  })
})

describe("after hydration", () => {
  it("becomes the Collapsible without a mismatch, keeping a <details> the reader opened before the script ran", async () => {
    const container = document.createElement("div")
    container.innerHTML = renderToString(<MarkdownContent markdown={EXPANDABLE} />)
    document.body.append(container)
    // The reader opens it before hydration.
    ;(container.querySelector("details") as HTMLDetailsElement).open = true
    const recoverable = vi.fn()
    const errors = vi.spyOn(console, "error").mockImplementation(() => {})
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => {
      root = hydrateRoot(container, <MarkdownContent markdown={EXPANDABLE} />, { onRecoverableError: recoverable })
    })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    cleanup = () => { act(() => root!.unmount()); container.remove() }
    expect(recoverable).not.toHaveBeenCalled()
    expect(errors).not.toHaveBeenCalled()
    errors.mockRestore()
    expect(container.querySelector("details")).toBeNull()
    const trigger = container.querySelector<HTMLElement>(".docs-expandable-trigger")!
    expect(trigger.tagName).toBe("BUTTON")
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    const panel = container.querySelector<HTMLElement>(".docs-expandable-body")!
    expect(panel.hasAttribute("hidden")).toBe(false)
    expect(trigger.getAttribute("aria-controls")).toBe(panel.id)
    await act(async () => trigger.click())
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(panel.getAttribute("hidden")).toBe("until-found")
  })

  it("a closed one hydrates closed and findable", async () => {
    const container = document.createElement("div")
    container.innerHTML = renderToString(<DocumentProperties properties={properties} />)
    document.body.append(container)
    let root: ReturnType<typeof hydrateRoot> | undefined
    await act(async () => { root = hydrateRoot(container, <DocumentProperties properties={properties} />) })
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)) })
    cleanup = () => { act(() => root!.unmount()); container.remove() }
    const trigger = container.querySelector<HTMLElement>(".docs-properties-trigger")!
    expect(trigger.tagName).toBe("BUTTON")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(container.querySelector(".docs-properties-panel")!.getAttribute("hidden")).toBe("until-found")
  })
})
