// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { MarkdownContent } from "./DocsRenderer"
import { pelePlaygroundUrl } from "./Mermaid"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
beforeEach(() => {
  host = document.createElement("div")
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

async function until(check: () => boolean) {
  for (let i = 0; i < 100 && !check(); i++) await act(() => new Promise((r) => setTimeout(r, 20)))
  expect(check()).toBe(true)
}

const FLOW = "flowchart TD\n  A[Mermaid text] --> B{Flowchart?}\n  B -- Yes --> C[Pele]"

describe("Mermaid (Pele)", () => {
  it("shows the source beside Pele's drawing, with a playground link and the render time", async () => {
    act(() => root.render(<MarkdownContent markdown={"```mermaid\n" + FLOW + "\n```"} />))
    const card = host.querySelector("[data-docstream-mermaid]")!
    expect(card.querySelector(".docs-pele-source")?.textContent).toContain("A[Mermaid text]")
    await until(() => !!card.querySelector(".docs-mermaid svg.pele"))
    expect(card.querySelector(".docs-mermaid svg")?.textContent).toContain("Flowchart?")
    expect(card.querySelector<HTMLAnchorElement>("a.docs-pele-action")?.href).toBe(pelePlaygroundUrl(FLOW))
    expect(card.querySelector(".docs-pele-time")?.textContent).toMatch(/ms$/)
  })

  it("shows Pele's error as text", async () => {
    act(() => root.render(<MarkdownContent markdown={"```mermaid\nflowchart TD\n  A -->\n```"} />))
    await until(() => !!host.querySelector(".docs-mermaid-error"))
    expect(host.querySelector(".docs-mermaid svg")).toBeNull()
  })

  it("leaves long sources out of the playground link", () => {
    expect(pelePlaygroundUrl("graph TD\n" + "  A --> B\n".repeat(2000))).toBeNull()
    expect(pelePlaygroundUrl("graph TD\n  A --> B")).toBe("https://pele.run/playground#source=graph+TD%0A++A+--%3E+B")
  })
})
