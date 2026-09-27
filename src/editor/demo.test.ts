import { describe, expect, it } from "vitest"
import { parseMarkdown, serializeMarkdown } from "@brett_lamy/docstream/gitbook"
import { astToTiptap, tiptapToAst } from "./convert"

const roundTrip = (markdown: string) => serializeMarkdown(tiptapToAst(astToTiptap(parseMarkdown(markdown))))

describe("demo block conversion", () => {
  it.each([
    '{% demo src="button/basic" %}\n',
    '{% demo src="button/basic" title="Basic button" %}\n',
    '{% demo src="button/variants" title="Variants" description="Every visual style" height="420" layout="multi" variants="full:Full,compact:Compact" viewport="tablet" %}\n',
    '{% demo src="card/sizes" height="60vh" layout="single" variants="sm,md:Medium,lg" viewport="phone" %}\n',
    '{% demo src="shell/app" description="Whole app shell" height="auto" layout="auto" viewport="desktop" %}\n',
  ])("round-trips %s", (markdown) => {
    expect(roundTrip(markdown)).toBe(markdown)
  })

  it("keeps every attribute on the gbDemo node", () => {
    const pm = astToTiptap(
      parseMarkdown(
        '{% demo src="button/variants" title="Variants" description="Styles" height="420" layout="multi" variants="full:Full,compact" viewport="tablet" %}\n'
      )
    )
    expect(pm.content?.[0]).toEqual({
      type: "gbDemo",
      attrs: {
        src: "button/variants",
        title: "Variants",
        description: "Styles",
        height: "420",
        layout: "multi",
        variants: [
          { id: "full", label: "Full" },
          { id: "compact", label: "compact" },
        ],
        viewport: "tablet",
        entry: null,
        files: null,
      },
    })
  })

  it("round-trips a demo between other blocks", () => {
    const markdown = '# Button\n\n{% demo src="button/basic" title="Basic" %}\n\nAfter the demo.\n'
    expect(roundTrip(markdown)).toBe(markdown)
  })
})

describe("tabs sync conversion", () => {
  it("preserves sync through TipTap", () => {
    const markdown = '{% tabs sync="pm" %}\n{% tab title="npm" %}\nnpm i\n{% endtab %}\n\n{% tab title="pnpm" %}\npnpm add\n{% endtab %}\n{% endtabs %}\n'
    const pm = astToTiptap(parseMarkdown(markdown))
    expect(pm.content?.[0]?.attrs).toEqual({ sync: "pm" })
    expect(serializeMarkdown(tiptapToAst(pm))).toBe(serializeMarkdown(parseMarkdown(markdown)))
    expect(serializeMarkdown(tiptapToAst(pm))).toContain('{% tabs sync="pm" %}')
  })

  it("leaves unsynced tabs without a sync attribute", () => {
    const markdown = '{% tabs %}\n{% tab title="A" %}\na\n{% endtab %}\n{% endtabs %}\n'
    const pm = astToTiptap(parseMarkdown(markdown))
    expect(pm.content?.[0]?.attrs).toBeUndefined()
    expect(serializeMarkdown(tiptapToAst(pm))).not.toContain("sync")
  })
})

describe("schema coverage", () => {
  it("converts every block node in the schema back to a markdown block (nothing silently dropped)", async () => {
    const { getGitbookSchema } = await import("./extensions")
    const schema = getGitbookSchema()
    const blockTypes = Object.values(schema.nodes).filter(
      (type) => type.isInGroup("block") && type.name !== "paragraph"
    )
    expect(blockTypes.map((t) => t.name)).toEqual(expect.arrayContaining(["gbDemo", "gbCommand"]))
    for (const type of blockTypes) {
      const node = type.createAndFill()
      expect(node, type.name).toBeTruthy()
      const ast = tiptapToAst({ type: "doc", content: [node!.toJSON()] })
      expect(ast.children.length, type.name).toBe(1)
    }
  })
})
