// @vitest-environment happy-dom
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Editor } from "@tiptap/core"
import { parseMarkdown } from "@brett_lamy/docstream/gitbook"
import { GitbookEditor } from "./Editor"
import { astToTiptap, serializeEditorMarkdown, tiptapToAst } from "./convert"
import { getGitbookSchema } from "./extensions"
import { SLASH_ITEMS, XSTATE_STARTER } from "./slash-menu"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
const machine = JSON.stringify({ initial: "idle", states: { idle: { on: { START: "working" } }, working: {} } })
const fence = (language: string, code: string) => `\`\`\`${language}\n${code}\n\`\`\`\n`
let host: HTMLDivElement
let root: Root
beforeEach(() => { host = document.createElement("div"); document.body.append(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })
async function until(check: () => boolean) {
  for (let i = 0; i < 150 && !check(); i++) await act(() => new Promise((r) => setTimeout(r, 20)))
  expect(check()).toBe(true)
}

describe("live diagram code blocks", () => {
  it.each(["xstate", "tscircuit", "ts-circuit"])("round-trips %s through the editor schema", (language) => {
    const markdown = fence(language, language === "xstate" ? machine : 'circuit.add(<resistor resistance="1k" />)')
    const doc = getGitbookSchema().nodeFromJSON(astToTiptap(parseMarkdown(markdown)))
    doc.check()
    expect(serializeEditorMarkdown(tiptapToAst(doc.toJSON()))).toBe(markdown)
  })

  it("updates an XState preview from real editor transactions, reports syntax errors, and recovers", async () => {
    let editor!: Editor
    let saved = ""
    await act(async () => root.render(<GitbookEditor markdown={fence("xstate", machine)} onChange={(md) => { saved = md }} onEditorReady={(instance) => { if (instance) editor = instance }} />))
    await until(() => !!host.querySelector("[data-docstream-xstate] .docs-mermaid svg"))
    const block = editor.state.doc.firstChild!
    await act(async () => { editor.commands.insertContentAt({ from: 1, to: block.nodeSize - 1 }, { type: "text", text: machine.replaceAll("working", "finished") }) })
    await until(() => !!host.querySelector(".docs-mermaid svg")?.textContent?.includes("finished"))
    expect(saved).toContain("finished")
    expect(host.querySelector('.gb-diagram-result')?.getAttribute("contenteditable")).toBe("false")
    await act(async () => { editor.commands.insertContentAt({ from: 1, to: editor.state.doc.firstChild!.nodeSize - 1 }, { type: "text", text: "{" }) })
    await until(() => !!host.querySelector('[role="alert"]'))
    await act(async () => { editor.commands.insertContentAt({ from: 1, to: editor.state.doc.firstChild!.nodeSize - 1 }, { type: "text", text: machine }) })
    await until(() => !!host.querySelector(".docs-mermaid svg"))
    expect(host.querySelector('[role="alert"]')).toBeNull()
  })

  it("authors a machine that invokes something: its edges and what it invokes show as it's typed", async () => {
    let editor!: Editor
    let saved = ""
    await act(async () => root.render(<GitbookEditor markdown={fence("xstate", machine)} onChange={(md) => { saved = md }} onEditorReady={(instance) => { if (instance) editor = instance }} />))
    await until(() => !!host.querySelector("[data-docstream-xstate] .docs-mermaid svg"))
    const invoking = JSON.stringify({ initial: "idle", states: { idle: { invoke: { src: "load", onDone: "ready", onError: "failed" } }, ready: {}, failed: {} } })
    await act(async () => { editor.commands.insertContentAt({ from: 1, to: editor.state.doc.firstChild!.nodeSize - 1 }, { type: "text", text: invoking }) })
    await until(() => !!host.querySelector(".docs-mermaid svg")?.textContent?.includes("invoke load"))
    const drawn = host.querySelector(".docs-mermaid svg")!.textContent!
    expect(drawn).toContain("done")
    expect(drawn).toContain("error")
    expect(saved).toContain('"invoke"')
    // Saved, it's what was typed, with nothing taken out or added.
    expect(saved).toBe(fence("xstate", invoking))
  })

  it("round-trips a TypeScript machine with an inline actor, leaving the source alone", () => {
    const source = 'createMachine({\n  initial: "a",\n  states: {\n    a: { invoke: { src: fromPromise(async () => load()), input: { id: 1 }, onDone: "b" } },\n    b: {}\n  }\n})'
    const markdown = fence("xstate", source)
    const doc = getGitbookSchema().nodeFromJSON(astToTiptap(parseMarkdown(markdown)))
    expect(serializeEditorMarkdown(tiptapToAst(doc.toJSON()))).toBe(markdown)
  })

  it("starts a new diagram with something that invokes, so that you can see how it's written, and it draws", async () => {
    expect(JSON.parse(XSTATE_STARTER).states.loading.invoke.src).toBe("fetchPage")
    await act(async () => root.render(<GitbookEditor markdown={fence("xstate", XSTATE_STARTER)} />))
    await until(() => !!host.querySelector(".docs-mermaid svg")?.textContent?.includes("invoke fetchPage"))
    const drawn = host.querySelector(".docs-mermaid svg")!.textContent!
    for (const text of ["FETCH", "done", "error", "RETRY"]) expect(drawn).toContain(text)
    expect(host.querySelector('[role="alert"]')).toBeNull()
  })

  it("edits circuit source while preserving the runtime frame", async () => {
    let editor!: Editor
    let saved = ""
    await act(async () => root.render(<GitbookEditor markdown={fence("tscircuit", 'circuit.add(<resistor resistance="1k" />)')} onChange={(md) => { saved = md }} onEditorReady={(instance) => { if (instance) editor = instance }} />))
    const frame = host.querySelector("[data-docstream-tscircuit] iframe")!
    expect(frame).not.toBeNull()
    await act(async () => { editor.commands.insertContentAt({ from: 1, to: editor.state.doc.firstChild!.nodeSize - 1 }, { type: "text", text: 'circuit.add(<resistor resistance="2k" />)' }) })
    await until(() => saved.includes('resistance="2k"'))
    expect(host.querySelector("iframe")).toBe(frame)
    expect(host.querySelector(".docs-split-source")?.textContent).toContain('resistance="2k"')
  })

  it("offers both diagram kinds in the slash menu", () => {
    expect(SLASH_ITEMS.some((item) => item.title === "XState diagram")).toBe(true)
    expect(SLASH_ITEMS.some((item) => item.title === "tscircuit example")).toBe(true)
  })
})
