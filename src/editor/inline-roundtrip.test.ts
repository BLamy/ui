/* The docstream inline round-trip table (docstream src/gitbook/inline-roundtrip.test.ts), through the editor. */
import { describe, expect, it } from "vitest"
import { parseMarkdown, serializeMarkdown, type DocumentNode } from "@brett_lamy/docstream/gitbook"
import { astToTiptap, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"
import { getGitbookSchema } from "./extensions"

const schema = getGitbookSchema()

/** Through the real ProseMirror schema, as in the live editor. */
function throughEditor(markdown: string): string {
  const doc = parseMarkdown(markdown)
  const node = schema.nodeFromJSON(astToTiptap(doc))
  node.check()
  const ast: DocumentNode = tiptapToAst(node.toJSON() as PMNode)
  if (doc.citations?.length) ast.citations = doc.citations
  return serializeEditorMarkdown(ast).trim()
}

const paragraph = (markdown: string) => astToTiptap(parseMarkdown(markdown)).content![0]!.content!

const INLINE_ROUND_TRIP_CASES = [
  // one link wrapping several runs
  "[**a** b](https://x.dev)",
  "[a **b** c](https://x.dev)",
  "[_a_ **b** ~~c~~](https://x.dev)",
  "[**bold** then `code`](https://x.dev)",
  "see [the docs](https://x.dev), then **run** it",
  // bold + italic triples, both marker characters, author's nesting order
  "***x***",
  "___x___",
  "**_x_**",
  "_**x**_",
  "*__x__*",
  "__*x*__",
  "***a** b*",
  "*a **b***",
  "___a__ b_",
  "_a __b___",
  "**bold***italic*",
  "**foo*bar*baz**",
  "*foo**bar**baz*",
  "~~**x**~~ and **~~x~~** and _~~x~~_",
  // the author's markers
  "*italic*",
  "__bold__",
  "**bold** and __bold__ and *it* and _it_",
  "*a* *b*",
  "**a**, **b**.",
  "un*frigging*believable and 2*3*4",
  // literal markers: intraword underscores, escapes, stray stars and tildes
  "snake_case and some_long_name and a_b_c",
  "\\*not italic\\* and \\_not italic\\_",
  "\\*\\*not bold\\*\\*",
  "2 * 3 * 4 = 24",
  "footnote* and a lone star *",
  "~~strike~~ and ~5 minutes and a~b",
  "C:\\temp\\new and a trailing \\\\",
  "array[0] and [x] and [y] (z)",
  "\\[not a link](https://x.dev)",
  "a lone ` backtick",
  // links inside emphasis and emphasis inside links
  "~~[link](https://x.dev) inside~~",
  "**[link](https://x.dev) inside bold**",
  "_[link](https://x.dev)_ and [_link_](https://x.dev)",
  "**a _b [c](https://x.dev)_ e**",
  "**a [b _c_](https://x.dev) d**",
  "***[x](https://x.dev)***",
  "_**[x](https://x.dev) y**_",
  "[a\\]b](https://x.dev)",
  "[a](https://x.dev) [b](https://y.dev)",
  // code inside links and emphasis
  "[`code`](https://x.dev)",
  "[**`code`**](https://x.dev)",
  "**bold `code` text** and _it `x` it_",
  "`a*b*c` and `x_y` and `[z](w)`",
  "``a`b`` and ` spaced `",
  "**[`Button`](https://x.dev) docs**",
  // references, citations, images and autolinks next to emphasis
  "**a** @brett **b**",
  "@brett **bold** #tag and $org/repo",
  "**claim**[^1] and _more_ [^2]",
  '<img src="https://x.dev/i.png" alt="i" /> *caption*',
  "https://x.dev and **https://x.dev**",
  "<https://x.dev> and [https://x.dev](https://x.dev)",
  "mail brett@replay.io about C# and $5",
]

describe("inline round-trip table through the editor", () => {
  it.each(INLINE_ROUND_TRIP_CASES)("%s", (s) => {
    expect(throughEditor(s)).toBe(s)
  })

  it.each(INLINE_ROUND_TRIP_CASES)("keeps the docstream AST: %s", (s) => {
    const doc = parseMarkdown(s)
    const node = schema.nodeFromJSON(astToTiptap(doc))
    expect(tiptapToAst(node.toJSON() as PMNode).children).toEqual(doc.children)
  })

  it.each(INLINE_ROUND_TRIP_CASES)("inside a list item and a table cell: %s", (s) => {
    expect(throughEditor(`- ${s}`)).toBe(`- ${s}`)
    const table = `| a | b |\n| --- | --- |\n| ${s} | x |`
    expect(throughEditor(table)).toBe(table)
  })
})

describe("mark spelling attrs", () => {
  it("puts marker and depth on each mark of a run spelled other than the default", () => {
    expect(paragraph("***x***")[0]!.marks).toEqual([
      { type: "bold", attrs: { delim: "**", depth: 1 } },
      { type: "italic", attrs: { delim: "*", depth: 0 } },
    ])
    expect(paragraph("**a [b _c_](https://x.dev)**")[2]!.marks).toEqual([
      { type: "bold", attrs: { delim: "**", depth: 0 } },
      { type: "italic", attrs: { delim: "_", depth: 2 } },
      { type: "link", attrs: { href: "https://x.dev", inner: true, delim: "link", depth: 1 } },
    ])
  })

  it("leaves default-spelled runs bare", () => {
    expect(paragraph("_**x**_ [**a** b](https://x.dev)")[0]!.marks).toEqual([{ type: "bold" }, { type: "italic" }])
  })

  it("survives the HTML (clipboard) form as data attributes", () => {
    const bold = schema.marks.bold!
    expect(bold.spec.toDOM!(bold.create({ delim: "__", depth: 1 }), true)).toEqual([
      "strong",
      { "data-md-delim": "__", "data-md-depth": "1" },
      0,
    ])
    const attrs: Record<string, string> = { "data-md-delim": "__", "data-md-depth": "1" }
    const element = {
      getAttribute: (name: string) => attrs[name] ?? null,
      hasAttribute: (name: string) => name in attrs,
      style: {},
    } as unknown as HTMLElement
    const rule = bold.spec.parseDOM!.find((r) => r.tag === "strong")!
    const getAttrs = rule.getAttrs as ((node: HTMLElement) => Record<string, unknown> | false | null) | undefined
    expect(getAttrs ? getAttrs(element) : rule.attrs).toMatchObject({ delim: "__", depth: 1 })
  })

  it("drops the spelling of a removed mark and spells an added one the default way", () => {
    const [run] = paragraph("***x***")
    const withoutItalic: PMNode = { type: "doc", content: [{ type: "paragraph", content: [{ ...run!, marks: run!.marks!.filter((m) => m.type !== "italic") }] }] }
    expect(serializeEditorMarkdown(tiptapToAst(withoutItalic)).trim()).toBe("**x**")
    const [it1] = paragraph("*x*")
    const withBold: PMNode = { type: "doc", content: [{ type: "paragraph", content: [{ ...it1!, marks: [...it1!.marks!, { type: "bold" }] }] }] }
    expect(serializeEditorMarkdown(tiptapToAst(withBold)).trim()).toBe("***x***")
  })

  it("keeps a multi-run link whole after the editor", () => {
    expect(throughEditor("A [**bold** link](https://x.dev) here.")).toBe("A [**bold** link](https://x.dev) here.")
    expect(serializeMarkdown(parseMarkdown("[**a** b](u)")).trim()).toBe("[**a** b](u)")
  })
})
