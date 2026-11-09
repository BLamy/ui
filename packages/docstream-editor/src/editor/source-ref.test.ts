import { describe, expect, it } from "vitest"
import { parseMarkdown, serializeMarkdown } from "@brett_lamy/docstream/gitbook"
import { astToTiptap, tiptapToAst } from "./convert"

describe("source reference conversion", () => {
  it("preserves file/export provenance through TipTap", () => {
    const markdown = '{% source-ref mount="ui" path="Button.stories.tsx" export="Primary" kind="story" title="Button" %}\n'
    const ast = parseMarkdown(markdown)
    const pm = astToTiptap(ast)

    expect(pm.content?.[0]).toEqual({
      type: "gbSourceRef",
      attrs: {
        mount: "ui",
        path: "Button.stories.tsx",
        exportName: "Primary",
        kind: "story",
        title: "Button",
      },
    })
    expect(serializeMarkdown(tiptapToAst(pm))).toBe(markdown)
  })
})
