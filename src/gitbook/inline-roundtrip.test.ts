import { describe, expect, it } from "vitest"
import type { Inline, TextNode } from "./ast"
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
