// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest"
import { Editor } from "@tiptap/core"
import { act } from "react"
import { createRoot } from "react-dom/client"
import { parseMarkdown, readDocumentProperties, setDocumentProperty } from "@brett_lamy/docstream/gitbook"
import { astToTiptap, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"
import { createGitbookExtensions, getGitbookSchema } from "./extensions"
import { GitbookEditor } from "./Editor"

const source = '---\n# Metadata\ntitle: "My note"\npriority: 4\ncomplete: false\ntags: [notes, work]\n---\n\n## Goal\n\nOriginal **important** paragraph.\n'
const editors: Editor[] = []
afterEach(() => { editors.splice(0).forEach((editor) => editor.destroy()); document.body.innerHTML = "" })

describe("document properties in the editor", () => {
  it("carries metadata through the real schema without treating YAML as body blocks", () => {
    const schema = getGitbookSchema()
    const node = schema.nodeFromJSON(astToTiptap(parseMarkdown(source)))
    node.check()
    expect(node.firstChild?.type.name).toBe("heading")
    expect(readDocumentProperties(node.attrs.properties).values.priority).toBe(4)
    expect(serializeEditorMarkdown(tiptapToAst(node.toJSON() as PMNode))).toBe(source)
  })
  it("preserves properties during body edits, and property commands participate in undo/redo", () => {
    const editor = new Editor({ extensions: createGitbookExtensions({ slashMenu: false, references: false }), content: astToTiptap(parseMarkdown(source)) })
    editors.push(editor)
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, " Edited.")
    expect(serializeEditorMarkdown(tiptapToAst(editor.getJSON() as PMNode))).toContain(source.split("\n\n")[0])
    const previous = editor.state.doc.attrs.properties
    editor.commands.setDocumentProperties(setDocumentProperty(previous, "priority", 7))
    expect(readDocumentProperties(editor.state.doc.attrs.properties).values.priority).toBe(7)
    editor.commands.undo()
    expect(editor.state.doc.attrs.properties).toEqual(previous)
    editor.commands.redo()
    expect(readDocumentProperties(editor.state.doc.attrs.properties).values.priority).toBe(7)
  })
  it("edits typed properties with normal onChange and applies external updates without emitting a save", async () => {
    const container = document.createElement("div"); document.body.append(container)
    const root = createRoot(container)
    const changes: string[] = []
    const render = (markdown: string) => root.render(<GitbookEditor markdown={markdown} toolbar={false} slashMenu={false} references={false} documentProperties={{ defaultOpen: true }} onChange={(value) => changes.push(value)} />)
    await act(async () => { render(source) })
    const checkbox = container.querySelector<HTMLInputElement>('input[aria-label="complete"]')!
    expect(checkbox).not.toBeNull()
    await act(async () => { checkbox.click() })
    expect(changes.at(-1)).toContain("complete: true")
    expect(changes.at(-1)).toContain("Original **important** paragraph.")
    const count = changes.length
    await act(async () => { render(source.replace("priority: 4", "priority: 9")) })
    expect(container.querySelector<HTMLInputElement>('input[aria-label="priority"]')!.value).toBe("9")
    expect(changes).toHaveLength(count)
    await act(async () => { root.unmount() })
  })
})
