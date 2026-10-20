import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { MarkdownContent } from "./DocsRenderer"
import type { ListNode } from "../gitbook/ast"
import { parseMarkdown } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"

const lists = (md: string) => parseMarkdown(md).children.filter((b): b is ListNode => b.type === "list")

describe("list boundaries (CommonMark)", () => {
  it.each([
    ["a new bullet after a blank line", "- a\n- b\n\n* c\n* d\n", [2, 2]],
    ["a new bullet on the next line", "- a\n* b\n", [1, 1]],
    ["+ after -", "- a\n+ b\n", [1, 1]],
    ["a new ordered delimiter", "1. a\n2. b\n\n1) c\n", [2, 1]],
    ["bullet → ordered", "- a\n1. b\n", [1, 1]],
  ])("starts a new list at %s", (_, md, sizes) => {
    expect(lists(md).map((l) => l.items.length)).toEqual(sizes)
    expect(serializeMarkdown(parseMarkdown(md))).toBe(md)
  })

  it.each([
    ["the same bullet across a blank line", "- a\n\n- b\n"],
    ["repeated numbers", "1. a\n1. b\n1. c\n"],
    ["a nested list with another bullet", "- a\n  * nested\n- b\n"],
  ])("keeps one list for %s", (_, md) => {
    expect(lists(md)).toHaveLength(1)
    expect(serializeMarkdown(parseMarkdown(md))).toBe(md)
  })
})

describe("ordered list start", () => {
  it("renders the first number as the list's start", () => {
    const html = renderToStaticMarkup(createElement(MarkdownContent, { markdown: "3. three\n4. four\n" }))
    expect(html).toMatch(/<ol[^>]* start="3"/)
  })

  it("leaves lists that start at 1 alone", () => {
    const html = renderToStaticMarkup(createElement(MarkdownContent, { markdown: "1. one\n2. two\n" }))
    expect(html).not.toMatch(/start=/)
  })
})

describe("content refs", () => {
  it("show links in their label as text, so the card's own link isn't nested", () => {
    const html = renderToStaticMarkup(
      createElement(MarkdownContent, { markdown: '{% content-ref url="b.md" %}\nSee [the slash menu](b.md) for more\n{% endcontent-ref %}\n' }),
    )
    expect(html.match(/<a\b/g)).toHaveLength(1)
    expect(html).toContain("the slash menu")
  })
})
