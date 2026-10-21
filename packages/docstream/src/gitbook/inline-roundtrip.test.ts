import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { CodeBlockNode, FigureNode, Inline, InlineImageNode, TabsNode, TextNode } from "./ast"
import { parseMarkdown, serializeMarkdown } from "./index"
import { parseInline, serializeInline } from "./inline"

const roundTrip = (s: string) => serializeMarkdown(parseMarkdown(s)).trim()

/** Tricky inline Markdown that must come back byte-for-byte (docstream-editor runs the same table through the editor). */
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

/**
 * Whole documents (reference definitions, block spacing and layout) that must come back byte-for-byte;
 * docstream-editor runs the same table through the editor.
 */
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

describe("inline round-trip table", () => {
  it("has 40+ cases", () => {
    expect(INLINE_ROUND_TRIP_CASES.length).toBeGreaterThanOrEqual(40)
  })

  it.each(INLINE_ROUND_TRIP_CASES)("parse → serialize is byte-stable: %s", (s) => {
    expect(roundTrip(s)).toBe(s)
  })

  it.each(INLINE_ROUND_TRIP_CASES)("the AST survives a second trip: %s", (s) => {
    const once = parseMarkdown(s)
    expect(parseMarkdown(serializeMarkdown(once))).toEqual(once)
  })

  it.each(INLINE_ROUND_TRIP_CASES)("round-trips inside a heading, list item and table cell: %s", (s) => {
    for (const md of [`## ${s}`, `- ${s}`]) expect(roundTrip(md)).toBe(md)
    if (!s.includes("|")) {
      const table = `| a | b |\n| --- | --- |\n| ${s} | x |`
      expect(roundTrip(table)).toBe(table)
    }
  })
})

describe("document round-trip table", () => {
  it.each(DOCUMENT_ROUND_TRIP_CASES)("parse → serialize is byte-stable: %j", (md) => {
    expect(serializeMarkdown(parseMarkdown(md))).toBe(md)
  })

  it.each(DOCUMENT_ROUND_TRIP_CASES)("the AST survives a second trip: %j", (md) => {
    const once = parseMarkdown(md)
    expect(parseMarkdown(serializeMarkdown(once))).toEqual(once)
  })
})

describe("docs pages corpus", () => {
  const dir = new URL("./__fixtures__/", import.meta.url)
  const pages = ["docs-page.md", ...readdirSync(new URL("./ui-pages/", dir)).filter((f) => f.endsWith(".md")).map((f) => `ui-pages/${f}`)]

  it("has the ui docs pages", () => {
    expect(pages.length).toBeGreaterThanOrEqual(20)
  })

  it.each(pages)("%s round-trips byte-for-byte", (page) => {
    const md = readFileSync(new URL(page, dir), "utf8")
    const doc = parseMarkdown(md)
    expect(serializeMarkdown(doc)).toBe(md)
    expect(parseMarkdown(serializeMarkdown(doc))).toEqual(doc)
  })
})

describe("inline AST shapes", () => {
  it("groups a multi-run link under one link", () => {
    expect(parseInline("[**a** b](u)")).toEqual([
      { type: "text", text: "a", bold: true, link: "u" },
      { type: "text", text: " b", link: "u" },
    ])
  })

  it("parses *** as italic around bold, remembering the markers", () => {
    expect(parseInline("***x***")).toEqual([{ type: "text", text: "x", italic: true, bold: true, delims: ["*", "**"] }])
    expect(parseInline("**_x_**")).toEqual([{ type: "text", text: "x", bold: true, italic: true, delims: ["**", "_"] }])
    // the default spelling records nothing
    expect(parseInline("_**x**_")).toEqual([{ type: "text", text: "x", italic: true, bold: true }])
    expect(parseInline("*x*")).toEqual([{ type: "text", text: "x", italic: true, delims: ["*"] }])
  })

  it("splits ***a** b* and *a **b*** per CommonMark", () => {
    expect(parseInline("***a** b*")).toEqual([
      { type: "text", text: "a", italic: true, bold: true, delims: ["*", "**"] },
      { type: "text", text: " b", italic: true, delims: ["*"] },
    ])
    expect(parseInline("*a **b***")).toEqual([
      { type: "text", text: "a ", italic: true, delims: ["*"] },
      { type: "text", text: "b", italic: true, bold: true, delims: ["*", "**"] },
    ])
  })

  it("keeps intraword underscores literal", () => {
    expect(parseInline("snake_case_name")).toEqual([{ type: "text", text: "snake_case_name" }])
  })

  it("records link placement and form", () => {
    expect(parseInline("**a [b _c_](u)**")[2]).toEqual({
      type: "text",
      text: "c",
      bold: true,
      italic: true,
      link: "u",
      linkInner: true,
      delims: ["**", "link", "_"],
    })
    expect(parseInline("<https://x.dev>")).toEqual([
      { type: "text", text: "https://x.dev", link: "https://x.dev", delims: ["<>"] },
    ])
    expect(parseInline("https://x.dev")).toEqual([{ type: "text", text: "https://x.dev", link: "https://x.dev" }])
    // no autolinks inside link text
    expect(parseInline("[https://x.dev](https://x.dev)")).toEqual([
      { type: "text", text: "https://x.dev", link: "https://x.dev", delims: ["link"] },
    ])
  })
})

describe("serializing programmatic nodes", () => {
  it("keeps today's default spelling", () => {
    const nodes: Inline[] = [
      { type: "text", text: "i", italic: true },
      { type: "text", text: " " },
      { type: "text", text: "b", bold: true },
      { type: "text", text: " " },
      { type: "text", text: "both", bold: true, italic: true },
      { type: "text", text: " " },
      { type: "text", text: "s", strike: true },
    ]
    expect(serializeInline(nodes)).toBe("_i_ **b** _**both**_ ~~s~~")
  })

  it("wraps consecutive runs sharing a link in one link", () => {
    expect(
      serializeInline([
        { type: "text", text: "a", bold: true, link: "u" },
        { type: "text", text: " b", link: "u" },
      ]),
    ).toBe("[**a** b](u)")
  })

  it("ignores delims for marks a run no longer has, and gives new marks the default spelling", () => {
    expect(serializeInline([{ type: "text", text: "x", italic: true, delims: ["**", "*"] }])).toBe("*x*")
    expect(serializeInline([{ type: "text", text: "x", italic: true, bold: true, delims: ["*"] }])).toBe("***x***")
    expect(serializeInline([{ type: "text", text: "edited", link: "https://x.dev", delims: ["<>"] }])).toBe(
      "[edited](https://x.dev)",
    )
  })

  it("escapes only what would otherwise parse as syntax", () => {
    expect(serializeInline([{ type: "text", text: "snake_case, 2 * 3, ~5, a[0]" }])).toBe("snake_case, 2 * 3, ~5, a[0]")
    expect(serializeInline([{ type: "text", text: "*x* _y_ `z` [a](b) ~~s~~" }])).toBe(
      "\\*x\\* \\_y\\_ \\`z\\` \\[a](b) \\~\\~s\\~\\~",
    )
    expect(serializeInline([{ type: "text", text: "code: `a` b" }])).toBe("code: \\`a\\` b")
  })

  it("picks a code fence longer than any backtick run inside", () => {
    expect(serializeInline([{ type: "text", text: "a`b", code: true }])).toBe("``a`b``")
    expect(serializeInline([{ type: "text", text: "`a`", code: true }])).toBe("`` `a` ``")
  })
})

describe("spelling helpers for editors", () => {
  it("inlineDelims reports the effective spelling, defaultInlineDelims the hint-free one", async () => {
    const { inlineDelims, defaultInlineDelims } = await import("./index")
    const [a, b] = parseInline("***a** b*") as [TextNode, TextNode]
    expect(inlineDelims(a)).toEqual(["*", "**"])
    expect(inlineDelims(b)).toEqual(["*"])
    expect(defaultInlineDelims(a)).toEqual(["_", "**"])
    expect(inlineDelims({ type: "text", text: "x", bold: true, link: "u" })).toEqual(["link", "**"])
  })
})

describe("1.2.4 representation", () => {
  const para = (md: string) => (parseMarkdown(md).children[0] as { children: Inline[] }).children

  it("keeps Markdown images Markdown and HTML images HTML", () => {
    expect(parseInline('![a](s.png "t")')).toEqual([{ type: "image", src: "s.png", alt: "a", title: "t", syntax: "markdown" }])
    expect(parseInline('<img src="s.png" class="c">')).toEqual([{ type: "image", src: "s.png", html: '<img src="s.png" class="c">' }])
    // a Markdown image inside a link: the link is a mark, and can span text
    expect(parseInline("[![a](s.png) b](u)")).toEqual([
      { type: "image", src: "s.png", alt: "a", syntax: "markdown", link: "u", delims: ["link"] },
      { type: "text", text: " b", link: "u" },
    ])
    // the HTML anchor of a badge is the image's own
    expect(parseInline('<a href="u"><img src="s.png"></a>')).toEqual([
      { type: "image", src: "s.png", link: "u", html: '<a href="u"><img src="s.png"></a>' },
    ])
  })

  it("rewrites recorded HTML only when the image changed", () => {
    const [img] = parseInline('<img src="s.png" class="c" alt="x">') as [InlineImageNode]
    expect(serializeInline([img])).toBe('<img src="s.png" class="c" alt="x">')
    expect(serializeInline([{ ...img, alt: "y" }])).toBe('<img src="s.png" alt="y" />')
  })

  it("records reference links' form and label, and definitions as blocks in place", () => {
    const doc = parseMarkdown('Intro\n\n[x]: https://x.dev "X"\n\nsee [docs][x], [x][] and [x]')
    expect(doc.children[1]).toEqual({ type: "definition", label: "x", url: "https://x.dev", title: "X" })
    expect((doc.children[2] as { children: Inline[] }).children).toEqual([
      { type: "text", text: "see " },
      { type: "text", text: "docs", link: "https://x.dev", linkRef: "x", delims: ["ref"] },
      { type: "text", text: ", " },
      { type: "text", text: "x", link: "https://x.dev", linkRef: "x", delims: ["collapsed"] },
      { type: "text", text: " and " },
      { type: "text", text: "x", link: "https://x.dev", linkRef: "x", delims: ["shortcut"] },
    ])
  })

  it("falls back to an inline link when the definition no longer matches, and names the label when the text changed", () => {
    const doc = parseMarkdown("[docs][x] and [x]\n\n[x]: https://x.dev\n")
    const [a, , b] = (doc.children[0] as { children: TextNode[] }).children
    a.link = "https://y.dev"
    b.text = "renamed"
    expect(serializeMarkdown(doc)).toBe("[docs](https://y.dev) and [renamed][x]\n\n[x]: https://x.dev\n")
  })

  it("keeps an HTML link's tag, following an edited href", () => {
    const [run] = parseInline('<a href="u" target="_blank">x</a>') as [TextNode]
    expect(run).toEqual({ type: "text", text: "x", link: "u", linkTag: '<a href="u" target="_blank">', delims: ["html"] })
    expect(serializeInline([{ ...run, link: "v" }])).toBe('<a href="v" target="_blank">x</a>')
  })

  it("gives the second of two adjacent links to the same target a linkId", () => {
    expect(parseInline("[a](u)[b](u)")).toEqual([
      { type: "text", text: "a", link: "u" },
      { type: "text", text: "b", link: "u", linkId: 1 },
    ])
    // runs of one link share it; a multi-run link needs none
    expect(parseInline("[a](u)[**b** c](u)").slice(1).map((n) => n.linkId)).toEqual([1, 1])
    expect(parseInline("[**a** b](u)").some((n) => n.linkId !== undefined)).toBe(false)
  })

  it("keeps escaped characters as their own runs", () => {
    expect(parseInline("snake\\_case")).toEqual([
      { type: "text", text: "snake" },
      { type: "text", text: "_", escaped: true },
      { type: "text", text: "case" },
    ])
    // the serializer always writes them escaped, and adds none of its own where not needed
    expect(serializeInline([{ type: "text", text: "a" }, { type: "text", text: ".", escaped: true }])).toBe("a\\.")
  })

  it("puts emphasis and links on chips and images, so emphasis spans them", () => {
    expect(parseInline("*see ![i](s) and @b*")).toEqual([
      { type: "text", text: "see ", italic: true, delims: ["*"] },
      { type: "image", src: "s", alt: "i", syntax: "markdown", italic: true, delims: ["*"] },
      { type: "text", text: " and ", italic: true, delims: ["*"] },
      { type: "reference", kind: "mention", id: "b", italic: true, delims: ["*"] },
    ])
    expect(serializeInline([
      { type: "text", text: "ask ", bold: true },
      { type: "reference", kind: "mention", id: "brett", bold: true },
    ])).toBe("**ask @brett**")
  })

  it("records nested same-type emphasis in delims", () => {
    expect(parseInline("*a *b* c*")[1]).toEqual({ type: "text", text: "b", italic: true, delims: ["*", "*"] })
  })

  it("records block spacing only where it differs from the default", () => {
    const doc = parseMarkdown('{% tabs %}\n{% tab title="a" %}\nA\n{% endtab %}\n{% tab title="b" %}\nB\n{% endtab %}\n{% endtabs %}\n')
    const tabs = doc.children[0] as TabsNode
    expect(tabs.tabs.map((t) => t.gap)).toEqual([undefined, 0])
    expect(parseMarkdown("a\n\nb\n").children.some((b) => b.gap !== undefined)).toBe(false)
  })

  it("keeps canonical output for programmatic nodes", () => {
    expect(
      serializeMarkdown({
        type: "doc",
        children: [
          { type: "tabs", tabs: [{ type: "tab", title: "a", children: [{ type: "paragraph", children: [{ type: "text", text: "A" }] }] }, { type: "tab", title: "b", children: [] }] },
          { type: "figure", src: "a.png", alt: "", caption: "" },
          { type: "table", header: [[{ type: "text", text: "h" }]], rows: [], align: ["center"] },
        ],
      }),
    ).toBe(
      '{% tabs %}\n{% tab title="a" %}\nA\n{% endtab %}\n\n{% tab title="b" %}\n{% endtab %}\n{% endtabs %}\n\n<figure><img src="a.png" alt=""><figcaption></figcaption></figure>\n\n| h |\n| :---: |\n',
    )
  })

  it("drops a recorded layout that no longer fits the node", () => {
    const [code] = parseMarkdown("~~~js   \nx\n~~~\n").children as [CodeBlockNode]
    expect(code).toMatchObject({ fence: "~~~", info: "js   ", language: "js" })
    expect(serializeMarkdown({ type: "doc", children: [{ ...code, language: "ts" }] })).toBe("~~~ts\nx\n~~~\n")
    const [fig] = parseMarkdown("![a](s.png)\n").children as [FigureNode]
    expect(serializeMarkdown({ type: "doc", children: [{ ...fig, alt: "b" }] })).toBe('<figure><img src="s.png" alt="b"><figcaption></figcaption></figure>\n')
    expect(para("x")).toEqual([{ type: "text", text: "x" }])
  })
})

