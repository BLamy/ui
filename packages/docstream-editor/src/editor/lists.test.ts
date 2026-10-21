/* Lists through the editor: separate lists stay separate (CommonMark list boundaries) and
   ordered lists keep their start number. */
import { describe, expect, it } from "vitest"
import { parseMarkdown, type DocumentNode } from "@brett_lamy/docstream/gitbook"
import { astToTiptap, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"
import { getGitbookSchema } from "./extensions"

const schema = getGitbookSchema()

function throughEditor(markdown: string): string {
  const node = schema.nodeFromJSON(astToTiptap(parseMarkdown(markdown)))
  node.check()
  return serializeEditorMarkdown(tiptapToAst(node.toJSON() as PMNode))
}

const listSizes = (markdown: string) =>
  parseMarkdown(markdown).children.flatMap((b) => (b.type === "list" ? [b.items.length] : []))

describe("lists through the editor", () => {
  it.each([
    "- a\n- b\n\n* c\n* d\n",
    "- a\n* b\n",
    "1. a\n2. b\n\n1) c\n",
    "3. three\n4. four\n",
    "- a\n  * nested\n- b\n",
  ])("round-trips %j", (md) => {
    expect(throughEditor(md)).toBe(md)
  })

  it("keeps two lists made side by side in the editor separate", () => {
    const item = (text: string) => ({ type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text }] }] })
    const doc: PMNode = {
      type: "doc",
      content: [
        { type: "bulletList", content: [item("a"), item("b")] },
        { type: "bulletList", content: [item("c")] },
        { type: "orderedList", content: [item("one")] },
        { type: "orderedList", content: [item("uno")] },
      ],
    }
    schema.nodeFromJSON(doc).check()
    const md = serializeEditorMarkdown(tiptapToAst(doc) as DocumentNode)
    expect(listSizes(md)).toEqual([2, 1, 1, 1])
    expect(throughEditor(md)).toBe(md)
  })
})
