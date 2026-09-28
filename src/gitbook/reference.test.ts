import { describe, expect, it } from "vitest"

import { parseInline, plainText, refDefinitions, serializeInline } from "./inline"
import { parseMarkdown, trimPartialInlineToken } from "./parse"
import { serializeMarkdown } from "./serialize"

const para = (doc: ReturnType<typeof parseMarkdown>, i = 0) => {
  const block = doc.children[i]
  if (block?.type !== "paragraph") throw new Error(`expected paragraph, got ${block?.type}`)
  return block.children
}

describe("mention and tag chips", () => {
  it("parses @mention and #tag at word boundaries", () => {
    expect(parseInline("ping @brett about #pricing")).toEqual([
      { type: "text", text: "ping " },
      { type: "reference", kind: "mention", id: "brett" },
      { type: "text", text: " about " },
      { type: "reference", kind: "tag", id: "pricing" },
    ])
  })

  it("recognizes chips at input start and after open brackets", () => {
    expect(parseInline("@brett")[0]).toMatchObject({ kind: "mention", id: "brett" })
    expect(parseInline("(#launch)")).toEqual([
      { type: "text", text: "(" },
      { type: "reference", kind: "tag", id: "launch" },
      { type: "text", text: ")" },
    ])
  })

  it("leaves emails and mid-word sigils as plain text", () => {
    expect(parseInline("mail brett@replay.io")).toEqual([{ type: "text", text: "mail brett@replay.io" }])
    expect(parseInline("we use C# daily")).toEqual([{ type: "text", text: "we use C# daily" }])
  })

  it("trims trailing punctuation from the chip id", () => {
    expect(parseInline("ping @brett.")).toEqual([
      { type: "text", text: "ping " },
      { type: "reference", kind: "mention", id: "brett" },
      { type: "text", text: "." },
    ])
  })

  it("supports escaping with a backslash", () => {
    // Escaped characters are their own runs, so the backslashes round-trip.
    expect(parseInline("\\@brett and \\#tag")).toEqual([
      { type: "text", text: "@", escaped: true },
      { type: "text", text: "brett and " },
      { type: "text", text: "#", escaped: true },
      { type: "text", text: "tag" },
    ])
    expect(plainText(parseInline("\\@brett and \\#tag"))).toBe("@brett and #tag")
  })

  it("parses chips inside bold spans", () => {
    expect(parseInline("**ask @brett**")).toEqual([
      { type: "text", text: "ask ", bold: true },
      // The chip carries the emphasis around it too.
      { type: "reference", kind: "mention", id: "brett", bold: true },
    ])
  })

  it("does not treat a bare sigil as a chip", () => {
    expect(parseInline("a @ b # c")).toEqual([{ type: "text", text: "a @ b # c" }])
  })
})

describe("codebase chips", () => {
  it("parses $codebase and $org/repo at word boundaries", () => {
    expect(parseInline("see $reading-room and $maple/stream-lab.")).toEqual([
      { type: "text", text: "see " },
      { type: "reference", kind: "codebase", id: "reading-room" },
      { type: "text", text: " and " },
      { type: "reference", kind: "codebase", id: "maple/stream-lab" },
      { type: "text", text: "." },
    ])
  })

  it("leaves prices, shell variables mid-word, and bare $ as plain text", () => {
    expect(parseInline("costs $5 or $ 10")).toEqual([{ type: "text", text: "costs $5 or $ 10" }])
    expect(parseInline("echo a$HOME")).toEqual([{ type: "text", text: "echo a$HOME" }])
  })

  it("round-trips through serialize, escaping literal text", () => {
    const src = "ship $reading-room with @luna in #general"
    expect(serializeInline(parseInline(src))).toBe(src)
    expect(serializeInline([{ type: "text", text: "$HOME is literal" }])).toBe("\\$HOME is literal")
    expect(parseInline("\\$HOME is literal")).toEqual([
      { type: "text", text: "$", escaped: true },
      { type: "text", text: "HOME is literal" },
    ])
  })
})

describe("footnote citations", () => {
  const doc = parseMarkdown(
    'Pistachio is up 18% [^1], sharpest on weekends [^snd].\n\n[^1]: https://scoopdata.io/q3 "ScoopData Q3"\n[^snd]: https://trends.google.com/ice-cream\n'
  )

  it("parses markers and resolves urls/labels from definitions", () => {
    expect(para(doc)).toContainEqual({
      type: "reference",
      kind: "citation",
      id: "1",
      url: "https://scoopdata.io/q3",
      label: "ScoopData Q3",
    })
    expect(para(doc)).toContainEqual({
      type: "reference",
      kind: "citation",
      id: "snd",
      url: "https://trends.google.com/ice-cream",
    })
  })

  it("collects doc-level citations in definition order and strips def lines", () => {
    expect(doc.citations).toEqual([
      { id: "1", url: "https://scoopdata.io/q3", label: "ScoopData Q3" },
      { id: "snd", url: "https://trends.google.com/ice-cream" },
    ])
    expect(doc.children).toHaveLength(1)
  })

  it("never lets footnote keys pollute refDefinitions", () => {
    parseMarkdown("[^1]: https://example.com\n\nsee [also][^1]\n")
    expect(refDefinitions.has("^1")).toBe(false)
  })

  it("renders a url-less marker when the definition is missing", () => {
    expect(para(parseMarkdown("half streamed [^9]"))).toContainEqual({
      type: "reference",
      kind: "citation",
      id: "9",
    })
  })

  it("keeps definition lines inside code fences as code content", () => {
    const doc = parseMarkdown('```markdown\n[^1]: https://example.com "X"\n```\n')
    expect(doc.citations).toBeUndefined()
    expect(doc.children[0]).toMatchObject({ type: "code", code: '[^1]: https://example.com "X"' })
  })

  it("leaves normal links and reference links untouched", () => {
    const nodes = parseInline("[site](https://a.io) and [docs][ref]")
    expect(nodes[0]).toMatchObject({ text: "site", link: "https://a.io" })
  })
})

describe("serialization round-trip", () => {
  it("round-trips a doc mixing chips, citations, and definitions", () => {
    const src =
      'Ask @brett about #seasonal trends [^1].\n\n[^1]: https://scoopdata.io/q3 "ScoopData Q3"\n'
    const once = serializeMarkdown(parseMarkdown(src))
    expect(once).toBe(src)
    expect(serializeMarkdown(parseMarkdown(once))).toBe(once)
  })

  it("escapes literal chip-like text at boundaries so it stays text", () => {
    const nodes: ReturnType<typeof parseInline> = [{ type: "text", text: "ping @brett" }]
    const md = serializeInline(nodes)
    expect(md).toBe("ping \\@brett")
    expect(plainText(parseInline(md))).toBe("ping @brett")
    expect(serializeInline(parseInline(md))).toBe(md)
  })

  it("does not escape emails", () => {
    expect(serializeInline([{ type: "text", text: "brett@replay.io" }])).toBe("brett@replay.io")
  })

  it("plainText keeps mention/tag markers and drops citation superscripts", () => {
    expect(plainText(parseInline("hi @brett [^1] #x"))).toBe("hi @brett  #x")
  })
})

describe("trimPartialInlineToken", () => {
  it("strips in-progress citation and chip tokens", () => {
    expect(trimPartialInlineToken("see [^1")).toBe("see ")
    expect(trimPartialInlineToken("see [^")).toBe("see ")
    expect(trimPartialInlineToken("ask @bre")).toBe("ask ")
    expect(trimPartialInlineToken("tag # ")).toBe("tag # ")
    expect(trimPartialInlineToken("tag #")).toBe("tag ")
    expect(trimPartialInlineToken("half \\")).toBe("half ")
  })

  it("leaves complete tokens and code fences alone", () => {
    expect(trimPartialInlineToken("done [^1] here")).toBe("done [^1] here")
    expect(trimPartialInlineToken("```js\nconst a = obj@foo")).toBe("```js\nconst a = obj@foo")
  })
})
