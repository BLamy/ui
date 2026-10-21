/* The docstream inline round-trip table (docstream src/gitbook/inline-roundtrip.test.ts), through the editor. */
// @ts-ignore node's types aren't installed; only these functions are needed.
import { readdirSync as untypedReaddirSync, readFileSync as untypedReadFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { parseMarkdown, serializeMarkdown, type DocumentNode } from "@brett_lamy/docstream/gitbook"
import { astToTiptap, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"
import { getGitbookSchema } from "./extensions"

const readdirSync = untypedReaddirSync as (url: URL) => string[]
const readFileSync = untypedReadFileSync as (url: URL, encoding: "utf8") => string

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
  // 1.2.4 — Markdown images stay Markdown, HTML images stay HTML, images inside links
  "![alt](https://x.dev/a.png) inline",
  'text ![alt](https://x.dev/a.png "The title") more',
  '<img src="https://x.dev/a.png" alt="x"> and <img src="b.png" class="c" alt="y"/>',
  "[![badge](https://x.dev/b.svg)](https://x.dev)",
  "[![a](https://x.dev/s.png) and text](https://x.dev)",
  '<a href="https://x.dev"><img src="https://x.dev/b.svg"></a> badge',
  // inline HTML links stay HTML
  '<a href="https://x.dev">x</a>',
  'a <a href="https://x.dev" target="_blank">**bold** link</a> b',
  '<a name="n" href="#n">#</A> anchor',
  // adjacent links to the same target stay distinct; one multi-run link stays one
  "[a](https://x.dev)[b](https://x.dev)",
  "[a](https://x.dev)[b](https://x.dev)[c](https://x.dev)",
  "**[a](https://x.dev)[b](https://x.dev)**",
  "<https://x.dev><https://x.dev>",
  "[![a](https://x.dev/s.png)](https://x.dev)[![b](https://x.dev/s.png)](https://x.dev)",
  "a [](https://x.dev) empty link",
  '[x](https://x.dev "Title") with a title',
  // author escapes survive, needed or not
  "snake\\_case and a \\* b",
  "\\# not a heading",
  "1\\. not a list",
  "foo\\.bar and \\<tag\\>",
  "\\!\\[not an image\\]",
  // emphasis spans chips and images
  "**ask @brett**",
  "*see ![i](https://x.dev/i.png)*",
  "~~#tag~~ and **$org/repo**",
  "[@brett](https://x.dev) and **[@brett](https://x.dev) text**",
  "_![i](https://x.dev/i.png)_ and ~~![j](https://x.dev/j.png)~~",
  "**claim [^1]**",
  // nested same-type emphasis
  "*a *b* c*",
  "**a **b** c**",
  "_a _b_ c_",
  // code spans keep their backtick count; a line-ending backslash stays
  "```inline``` code and `` a ` b ``",
  "ends with a backslash\\",
]

/** docstream's document table (reference definitions, block spacing and layout), through the editor. */
const DOCUMENT_ROUND_TRIP_CASES = [
  // reference-style links and images, definitions where the author put them
  "see [docs][ref] now\n\n[ref]: https://x.dev\n",
  '[docs][] and [Docs]\n\n[docs]: https://x.dev "Docs"\n',
  "[a][b] and [c][b]\n\n[b]: https://b.dev\n[c]: https://c.dev\n",
  "[ref]: https://x.dev\n\nuse [ref] early\n",
  "![logo][] and ![logo] and ![alt][logo]\n\n[logo]: https://x.dev/l.png\n",
  "[![Build][badge]][build]\n\n[badge]: https://x.dev/b.svg\n[build]: https://x.dev\n",
  "\\[docs] stays text\n\n[docs]: https://x.dev\n",
  // footnote definitions anywhere
  "claim [^1]\n\n[^1]: https://x.dev\n\nmore text\n",
  // tab (and other) blocks written without blank lines between them, or with extra ones
  '{% tabs %}\n{% tab title="npm" %}\nA\n{% endtab %}\n{% tab title="pnpm" %}\nB\n{% endtab %}\n{% endtabs %}\n',
  '{% tabs %}\n\n{% tab title="npm" %}\n\nA\n\n{% endtab %}\n\n\n{% tab title="pnpm" %}\nB\n{% endtab %}\n\n{% endtabs %}\n',
  '{% hint style="info" %}\n\nText\n\n{% endhint %}\n',
  "{% stepper %}\n{% step %}\n### One\nA\n{% endstep %}\n{% step %}\n### Two\n\nB\n{% endstep %}\n{% endstepper %}\n",
  "{% columns %}\n{% column %}\nA\n{% endcolumn %}\n{% column %}\nB\n{% endcolumn %}\n{% endcolumns %}\n",
  '{% updates format="full" %}\n{% update date="2026-01-01" %}\nA\n{% endupdate %}\n{% update date="2026-02-01" %}\nB\n{% endupdate %}\n{% endupdates %}\n',
  "<details>\n<summary>S</summary>\nBody\n</details>\n",
  "<details><summary>S</summary>\n\nBody\n\n</details>\n",
  "Text\n\n\n\nMore\n",
  "\n\nLeading blank lines\n",
  "Trailing blank lines\n\n\n",
  "Heading next\n# H\nParagraph right after\n",
  // tags as written: quotes, spacing, defaults, extra attributes, aliases, step headings, unknown tags
  "{% hint style='info' %}\nx\n{% endhint %}\n",
  "{% hint %}\nx\n{% endhint %}\n",
  '{%  hint style="warning"  %}\nx\n{%endhint%}\n',
  '{% columns %}\n{% column width="50%" %}\nA\n{% endcolumn %}\n{% column width="50%" %}\nB\n{% endcolumn %}\n{% endcolumns %}\n',
  '{% tabs %}\n{% tab title="a" icon="x" %}\nA\n{% endtab %}\n{% endtabs %}\n',
  "{% stepper %}\n{% step %}\n## Two hashes\nA\n{% endstep %}\n{% step %}\n\n### **Bold** step\n\nB\n{% endstep %}\n{% endstepper %}\n",
  '{% openapi src="petstore" path="/pets" method="get" %}\n[petstore](https://x.dev/openapi.json)\n{% endopenapi %}\n',
  '{% embed url="https://x.dev/v" %}\n{% endembed %}\n',
  '{% file src="a.pdf" caption="A" %}\n',
  '{% component path="a.tsx" %}\n{% endcomponent %}\n',
  '{% include "x.md" %}\n',
  "{% command %}\nnpm i x\n{% endcommand %}\n",
  '{% code title="a.ts" %}\n```ts\nconst a = 1\n```\n{% endcode %}\n',
  "$$\na\n$$ trailing\n",
  // lists
  "* a\n* b\n",
  "+ a\n+ b\n",
  "3. a\n4. b\n",
  "1) a\n2) b\n",
  "1. a\n1. b\n1. c\n",
  "- a\n\n- b\n",
  "-   a\n-   b\n",
  "- [X] done\n- [ ] todo\n",
  "- a\n    - four-space nested\n- b\n",
  "1. one\n   - nested\n\n   more\n2. two\n",
  "  * indented list\n  * item\n",
  // code
  "~~~\ncode\n~~~\n",
  "````md\n```js\nx\n```\n````\n",
  "```js   \nx\n```\n",
  "  ```\n  indented fence\n  ```\n",
  "    indented\n    code\n",
  "```\nunclosed at the end\n",
  // tables
  "| a | b |\n| :-- | --: |\n| 1 | 2 |\n",
  "| a | b | c |\n| :---: | --- | ---: |\n| 1 | 2 | 3 |\n",
  "|a|b|\n|-|-|\n|1|2|\n",
  "| a   | bbb |\n| --- | --- |\n| 1   | 2   |\n",
  "| `a|b` | `c\\|d` |\n| --- | --- |\n| x | y |\n",
  "<table>\n  <tr><th>A</th></tr>\n  <tr><td>x</td></tr>\n</table>\n",
  // headings, rules, quotes, paragraphs
  "Title\n=====\n\nSub\n---\n",
  "# Title #\n",
  "### Trailing spaces   \n",
  "***\n\n___\n\n- - -\n",
  ">no space\n>more\n",
  "> a\n>\n> b\n",
  ">[!NOTE]\n> mixed markers\n",
  "line one\nline two\n  indented continuation\n",
  "hard  \nbreak and a\\\nbackslash break\n",
  "  indented paragraph\n",
  "trailing spaces  \n",
  "  \n\nwhitespace-only blank line above\n",
  // images alone on a line
  "![alt](https://x.dev/a.png)\n",
  '![alt](https://x.dev/a.png "t")\n',
  '<img src="https://x.dev/a.png" alt="x">\n',
  '<figure><img src="a.png" alt="A"><figcaption><p>Cap <strong>bold</strong></p></figcaption></figure>\n',
  // line endings
  "# CRLF\r\n\r\ntext\r\n",
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

/** The whole document through the real schema, as in the live editor (not trimmed). */
function documentThroughEditor(markdown: string): string {
  const doc = parseMarkdown(markdown)
  const node = schema.nodeFromJSON(astToTiptap(doc))
  node.check()
  const ast: DocumentNode = tiptapToAst(node.toJSON() as PMNode)
  if (doc.citations?.length) ast.citations = doc.citations
  return serializeEditorMarkdown(ast)
}

describe("document round-trip table through the editor", () => {
  it.each(DOCUMENT_ROUND_TRIP_CASES)("%j", (md) => {
    expect(documentThroughEditor(md)).toBe(md)
  })

  it.each(DOCUMENT_ROUND_TRIP_CASES)("keeps the docstream AST: %j", (md) => {
    const doc = parseMarkdown(md)
    const node = schema.nodeFromJSON(astToTiptap(doc))
    const { citations: _citations, ...back } = { ...tiptapToAst(node.toJSON() as PMNode), citations: undefined }
    const { citations: _c, ...want } = doc
    // The editor always states a code block's `live` / `entry` (false / null), which serialize the same as absent.
    const settle = (v: unknown) =>
      JSON.parse(JSON.stringify(v, (k, x) => ((k === "live" && x === false) || (k === "entry" && x === null) ? undefined : x)))
    expect(settle(back)).toEqual(settle(want))
  })

  it("is stable when edited again (a second trip changes nothing)", () => {
    for (const md of DOCUMENT_ROUND_TRIP_CASES) expect(documentThroughEditor(documentThroughEditor(md))).toBe(md)
  })
})

describe("the ui docs pages through the editor", () => {
  const dir = new URL("./__fixtures__/ui-pages/", import.meta.url)
  const pages = readdirSync(dir).filter((f) => f.endsWith(".md"))

  it("has the pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(20)
  })

  it.each(pages)("%s round-trips byte-for-byte", (page) => {
    const md = readFileSync(new URL(page, dir), "utf8")
    expect(documentThroughEditor(md)).toBe(md)
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

  it("keeps nested same-type emphasis: the inner occurrence rides on the mark as `more`", () => {
    expect(paragraph("*a *b* c*")[1]!.marks).toEqual([{ type: "italic", attrs: { delim: "*", depth: 0, more: [[1, "*"]] } }])
    expect(throughEditor("*a *b* c*")).toBe("*a *b* c*")
  })

  it("carries escapes, link details and chip / image marks", () => {
    expect(paragraph("snake\\_case")[1]).toEqual({ type: "text", text: "_", marks: [{ type: "mdEscaped" }] })
    expect(paragraph("[a](u)[b](u)")[1]!.marks).toEqual([{ type: "link", attrs: { href: "u", md: { linkId: 1 } } }])
    expect(paragraph("**ask @brett**")[1]).toMatchObject({ type: "gbReference", marks: [{ type: "bold" }] })
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
