// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Editor } from "@tiptap/core"
import { parseMarkdown } from "@brett_lamy/ui/docstream/gitbook"
import { GitbookEditor } from "./Editor"
import { astToTiptap, serializeEditorMarkdown, tiptapToAst } from "./convert"
import { getGitbookSchema } from "./extensions"
import { SLASH_ITEMS, WORKERD_STARTER } from "./slash-menu"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const fence = (code: string) => `\`\`\`capnp\n${code}\n\`\`\`\n`
let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks() })
async function until(check: () => boolean) {
  // The first board waits for a cold import of the Cloudflare entry (the diagram and its catalog): give it time under load.
  for (let i = 0; i < 500 && !check(); i++) await act(() => new Promise((r) => setTimeout(r, 20)))
  expect(check()).toBe(true)
}
// The services' cards: not the system's own box around them.
const nodes = () => [...host.querySelectorAll('[data-docstream-capnp] [data-slot=diagram-node]:not([data-node^="cloudflare:"])')].map((n) => n.getAttribute("data-node")).sort()

describe("a workerd config in the editor", () => {
  it("round-trips through the editor schema", () => {
    const markdown = fence(WORKERD_STARTER)
    const doc = getGitbookSchema().nodeFromJSON(astToTiptap(parseMarkdown(markdown)))
    doc.check()
    expect(serializeEditorMarkdown(tiptapToAst(doc.toJSON()))).toBe(markdown)
  })

  it("draws its services beside the source, and follows what's typed", async () => {
    let editor!: Editor
    let saved = ""
    await act(async () => root.render(<GitbookEditor markdown={fence(WORKERD_STARTER)} onValueChange={(md) => { saved = md }} onEditorReady={(instance) => { if (instance) editor = instance }} />))
    await until(() => nodes().length === 2)
    expect(nodes()).toEqual(["main", "main.Room"])
    expect(host.querySelector(".gb-code-capnp .gb-diagram-result")?.getAttribute("contenteditable")).toBe("false")
    // The same result pane the read-only card draws, beside the editable source the other diagram fences have.
    expect(host.querySelector(".gb-code-capnp .gb-diagram-result > .docs-capnp-result .docs-split-label")?.textContent).toBe("Cloudflare services")
    expect(host.querySelector(".gb-code-capnp .docs-split-source-pane .docs-split-label")?.textContent).toBe("workerd config")
    const second = WORKERD_STARTER.replace('bindings = [ (name = "ROOMS", durableObjectNamespace = "Room") ],', 'bindings = [ (name = "ROOMS", durableObjectNamespace = "Room"), (name = "CACHE", kvNamespace = "cache") ],')
    await act(async () => { editor.commands.insertContentAt({ from: 1, to: editor.state.doc.firstChild!.nodeSize - 1 }, { type: "text", text: second }) })
    await until(() => nodes().length === 3)
    expect(nodes()).toContain("kv:cache")
    expect(saved).toContain("kvNamespace")
  })

  it("offers one in the slash menu", () => {
    const item = SLASH_ITEMS.find((i) => i.title === "workerd config")
    expect(item?.keywords).toContain("capnp")
  })

  it("draws an embedded .capnp file", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(WORKERD_STARTER))
    await act(async () => root.render(<GitbookEditor markdown={'{% embed url="https://host.test/config.capnp" %}\n'} />))
    await until(() => nodes().length === 2)
  })
})
