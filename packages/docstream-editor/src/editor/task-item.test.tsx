// @vitest-environment happy-dom
import { act } from "react"
import { Editor } from "@tiptap/core"
import { describe, expect, it } from "vitest"
import { TASK_STATES, parseMarkdown } from "@brett_lamy/docstream/gitbook"
import { astToTiptap, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"
import { createGitbookExtensions, getGitbookSchema } from "./extensions"

describe("native task state editing", () => {
  it("round-trips all states through the real editor schema", () => {
    const markdown = TASK_STATES.map((state) => `- [${state.marker}] ${state.label}`).join("\n") + "\n"
    const node = getGitbookSchema().nodeFromJSON(astToTiptap(parseMarkdown(markdown)))
    node.check()
    expect(serializeEditorMarkdown(tiptapToAst(node.toJSON() as PMNode))).toBe(markdown)
  })
  it("clicks clear any mark then verify it, and the icon menu writes the selected marker with undo support", async () => {
    const element = document.createElement("div"); document.body.append(element)
    let editor: Editor
    await act(async () => { editor = new Editor({ element, extensions: createGitbookExtensions({ slashMenu: false, references: false }), content: astToTiptap(parseMarkdown("- [~] Review\n")) }) })
    const checkbox = () => element.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    const markdown = () => serializeEditorMarkdown(tiptapToAst(editor!.getJSON() as PMNode))
    await act(async () => { checkbox().click() })
    expect(markdown()).toBe("- [ ] Review\n")
    await act(async () => { checkbox().click() })
    expect(markdown()).toBe("- [x] Review\n")
    await act(async () => { checkbox().dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })) })
    expect(document.querySelectorAll('[role="menuitemradio"] [data-state-icon]')).toHaveLength(8)
    await act(async () => { document.querySelector<HTMLButtonElement>('[role="menuitemradio"][data-state="blocked"]')!.click() })
    expect(markdown()).toBe("- [b] Review\n")
    await act(async () => { editor!.commands.undo() })
    expect(markdown()).toBe("- [x] Review\n")
    await act(async () => { editor!.destroy() }); element.remove()
  })
})
