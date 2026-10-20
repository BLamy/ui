/* docstream 1.2.2: inline code combined with link/bold/italic/strike, escaped tag attributes, demo looks. */
import { describe, expect, it } from "vitest"
import { getSchema } from "@tiptap/core"
import StarterKit from "@tiptap/starter-kit"
import { parseMarkdown, type DocumentNode } from "@brett_lamy/docstream/gitbook"
import { astToTiptap, markdownPasteContent, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"
import { getGitbookSchema } from "./extensions"

const schema = getGitbookSchema()

function throughEditor(markdown: string): string {
  const doc = parseMarkdown(markdown)
  const node = schema.nodeFromJSON(astToTiptap(doc))
  node.check()
  const ast: DocumentNode = tiptapToAst(node.toJSON() as PMNode)
  if (doc.citations?.length) ast.citations = doc.citations
  return serializeEditorMarkdown(ast)
}

/** What the paste handler inserts, validated against the schema the way ProseMirror does. */
function pasted(text: string) {
  const content = markdownPasteContent(text)?.content
  expect(content?.length).toBeTruthy()
  const node = schema.nodeFromJSON({ type: "doc", content })
  node.check()
  return node
}

const LINES = [
  "Install [`@brett_lamy/ui`](https://www.npmjs.com/package/@brett_lamy/ui) first.",
  "Some **bold `x` text** here.",
  "Some _italic `y` text_ here.",
  "Some ~~struck `z` text~~ here.",
  "A **[`Button`](https://example.com/button) link** in bold.",
  "A [**`bold code`**](https://example.com) link and `plain code`.",
  "Struck ~~[`gone`](https://example.com)~~, italic _[`linked`](https://example.com)_.",
  "Run `npm i` then **`npx ui add`**, _`--force`_ and ~~`--legacy`~~.",
]

describe("inline code with other marks", () => {
  it("the stock TipTap code mark rejects these runs (control)", () => {
    const stock = getSchema([StarterKit])
    const doc = astToTiptap(parseMarkdown(LINES[0] + "\n"))
    expect(() => stock.nodeFromJSON(doc).check()).toThrow(/Invalid collection of marks for node text: (link,code|code,link)/)
    expect(() => stock.nodeFromJSON(astToTiptap(parseMarkdown(LINES[1] + "\n"))).check()).toThrow(/bold,code/)
  })

  it.each(LINES)("round-trips %s byte-for-byte", (line) => {
    const markdown = `${line}\n`
    expect(throughEditor(markdown)).toBe(markdown)
  })

  it("keeps both marks on the run", () => {
    const text = pasted("Install [`@brett_lamy/ui`](https://x.dev) and **bold `x` text**.\n\n## Next").firstChild!
    const runs = text.content.content.map((n) => [n.text, n.marks.map((m) => m.type.name).sort().join(",")])
    expect(runs).toEqual(expect.arrayContaining([
      ["@brett_lamy/ui", "code,link"],
      ["x", "bold,code"],
    ]))
  })

  it("pasting a docs page with such runs keeps the whole paste", () => {
    const page = ["# Title", "", ...LINES.flatMap((l) => [l, ""]), "```ts", "const a = 1", "```", ""].join("\n")
    const node = pasted(page)
    expect(node.childCount).toBe(LINES.length + 2)
    expect(throughEditor(page)).toBe(page)
  })
})

describe("escaped tag attributes and demo looks", () => {
  it("round-trips quotes, backslashes and %} in titles", () => {
    const markdown = [
      '{% tabs title="Install \\"ui\\"" sync="pm" %}',
      '{% tab title="npm \\"i\\"" %}',
      '{% demo src="a/b" title="Say \\"hi\\" C:\\\\x 100%\\}" status="Live" %}',
      "{% endtab %}",
      "{% endtabs %}",
      "",
    ].join("\n")
    expect(throughEditor(markdown)).toBe(markdown)
    const demo = astToTiptap(parseMarkdown(markdown)).content![0]!.content![0]!.content![0]!
    expect(demo.attrs).toMatchObject({ title: 'Say "hi" C:\\x 100%}', status: "Live" })
  })

  it("keeps the fence line-number attribute as written", () => {
    for (const md of ["```ts\nx\n```\n", '```ts lineNumbers="false"\nx\n```\n', '```ts lineNumbers="true"\nx\n```\n', '```ts title="a.ts"\nx\n```\n', '```ts title="a.ts" lineNumbers="false"\nx\n```\n']) {
      expect(throughEditor(md)).toBe(md)
    }
  })
})
