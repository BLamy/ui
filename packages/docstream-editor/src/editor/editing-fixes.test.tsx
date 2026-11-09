// @vitest-environment happy-dom
/* Edits that used to be lost on save: hard breaks, a second paragraph in a table cell, and
   underline (now off — Markdown can't hold it); plus `editable` and the toolbar's active marks
   following the editor after mount. */
import { act } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { parseMarkdown } from "@brett_lamy/docstream/gitbook"
import type { Editor as TiptapEditor } from "@tiptap/react"
import { astToTiptap, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"
import { GitbookEditor } from "./Editor"
import { getGitbookSchema } from "./extensions"

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const schema = getGitbookSchema()
const save = (doc: PMNode) => serializeEditorMarkdown(tiptapToAst(doc))
const through = (md: string) => {
  const node = schema.nodeFromJSON(astToTiptap(parseMarkdown(md)))
  node.check()
  return save(node.toJSON() as PMNode)
}
const text = (t: string, marks?: PMNode["marks"]) => ({ type: "text", text: t, ...(marks ? { marks } : {}) })

describe("hard breaks", () => {
  it("save as a backslash line break", () => {
    const doc: PMNode = { type: "doc", content: [{ type: "paragraph", content: [text("hello"), { type: "hardBreak" }, text("world")] }] }
    schema.nodeFromJSON(doc).check()
    expect(save(doc)).toBe("hello\\\nworld\n")
  })

  it("load as real breaks and round-trip, inside marks too", () => {
    const pm = astToTiptap(parseMarkdown("hello\\\nworld\n"))
    expect(pm.content![0]!.content!.map((n) => n.type)).toEqual(["text", "hardBreak", "text"])
    for (const md of ["hello\\\nworld\n", "**bold\\\nline** after\n", "two  \nspaces\n", "`code\\` span\n"]) expect(through(md)).toBe(md)
  })
})

describe("table cells", () => {
  it("keep every paragraph's text on the cell's one line", () => {
    const cell = (type: string, ...paras: string[]) => ({ type, content: paras.map((p) => ({ type: "paragraph", content: [text(p)] })) })
    const doc: PMNode = {
      type: "doc",
      content: [{ type: "table", content: [{ type: "tableRow", content: [cell("tableHeader", "A"), cell("tableHeader", "B")] }, { type: "tableRow", content: [cell("tableCell", "first", "second"), cell("tableCell", "z")] }] }],
    }
    schema.nodeFromJSON(doc).check()
    const md = save(doc)
    expect(md).toContain("first second")
    expect(parseMarkdown(md).children[0]!.type).toBe("table")
  })
})

describe("GitbookEditor after mount", () => {
  let host: HTMLDivElement
  let root: Root
  beforeEach(() => {
    host = document.createElement("div")
    document.body.appendChild(host)
    root = createRoot(host)
  })
  afterEach(() => {
    act(() => root.unmount())
    host.remove()
  })

  it("has no underline mark", () => {
    expect(schema.marks.underline).toBeUndefined()
  })

  it("follows the editable prop", async () => {
    let editor: TiptapEditor | null = null
    const render = (editable: boolean) =>
      act(async () => root.render(<GitbookEditor markdown="Hi" editable={editable} onEditorReady={(e) => (editor = e)} />))
    await render(true)
    expect(editor!.isEditable).toBe(true)
    await render(false)
    expect(editor!.isEditable).toBe(false)
    await render(true)
    expect(editor!.isEditable).toBe(true)
  })

  it("lights the toolbar for the marks under the selection", async () => {
    let editor: TiptapEditor | null = null
    await act(async () => root.render(<GitbookEditor markdown="plain **bold**" onEditorReady={(e) => (editor = e)} />))
    const bold = () => host.querySelector<HTMLButtonElement>('.gb-toolbar button[title="Bold"]')!
    const isOn = () => bold().classList.contains("gb-tool-active")
    await act(async () => void editor!.commands.setTextSelection(3))
    expect(isOn()).toBe(false)
    await act(async () => void editor!.commands.setTextSelection(10))
    expect(isOn()).toBe(true)
  })
})
