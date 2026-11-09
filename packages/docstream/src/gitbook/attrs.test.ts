import { describe, expect, it } from "vitest"
import type { DemoNode, TabsNode } from "./ast"
import { escapeAttr, parseAttrs, unescapeAttr } from "./attrs"
import { parseMarkdown } from "./parse"
import { serializeMarkdown } from "./serialize"
import { resolveDemosToMarkdown } from "../demo/markdown"
import type { DemoResolver } from "../demo/types"

const NASTY = [
  'Say "hi"',
  "C:\\path\\to\\file",
  "ends with a backslash \\",
  'a \\"pre-escaped\\" quote',
  "100% done %} not the end",
  "{% nested %} tag",
  "%}%}\\%}",
  "quote at end\"",
]

describe("tag attribute escaping", () => {
  it("escape/unescape are inverse", () => {
    for (const value of NASTY) {
      expect(unescapeAttr(escapeAttr(value))).toBe(value)
      expect(escapeAttr(value)).not.toContain("%}")
      expect(parseAttrs(`title="${escapeAttr(value)}" x="1"`)).toEqual({ title: value, x: "1" })
    }
  })

  it("keeps hand-written backslashes that escape nothing", () => {
    expect(parseAttrs('title="C:\\temp\\new"')).toEqual({ title: "C:\\temp\\new" })
  })

  it("round-trips demo titles and descriptions with quotes, backslashes and %}", () => {
    for (const value of NASTY) {
      const node: DemoNode = { type: "demo", src: "a/b", title: value, description: `${value} — **desc**` }
      const markdown = serializeMarkdown({ type: "doc", children: [node] })
      expect(markdown.split("\n")).toHaveLength(2)
      const doc = parseMarkdown(markdown)
      expect(doc.children).toEqual([node])
      expect(serializeMarkdown(doc)).toBe(markdown)
    }
  })

  it("round-trips the block form (files after an escaped tag) and demos nested in tabs", () => {
    const node: DemoNode = {
      type: "demo",
      src: "x/y",
      title: 'The "best" demo %}',
      files: [{ path: 'odd "name".tsx', language: "tsx", content: "export default () => null" }],
    }
    const tabs: TabsNode = { type: "tabs", title: 'Install "ui"', tabs: [{ type: "tab", title: 'npm "i"', children: [node] }] }
    const markdown = serializeMarkdown({ type: "doc", children: [tabs] })
    expect(markdown).toContain('{% tabs title="Install \\"ui\\"" %}')
    expect(markdown).toContain('{% demo src="x/y" title="The \\"best\\" demo %\\}" %}')
    expect(parseMarkdown(markdown).children).toEqual([tabs])
  })

  it("escapes every tag family (hint, embed, source-ref, command, updates…)", () => {
    const markdown = [
      '{% embed url="https://e.com/?q=%22" title="A \\"talk\\"" %}',
      "",
      '{% source-ref mount="demo" path="A.tsx" export="A" kind="component" title="The \\"A\\" part" %}',
      "",
      '{% command pnpm="pnpm dlx \\"x\\"" %}npx "x"{% endcommand %}',
      "",
      '{% updates format="full" %}',
      '{% update date="2026 \\"Q3\\"" %}',
      "Shipped.",
      "{% endupdate %}",
      "{% endupdates %}",
      "",
    ].join("\n")
    const doc = parseMarkdown(markdown)
    expect(doc.children[0]).toMatchObject({ type: "embed", title: 'A "talk"' })
    expect(doc.children[1]).toMatchObject({ type: "source-ref", title: 'The "A" part' })
    expect(doc.children[2]).toMatchObject({ type: "command", command: 'npx "x"', overrides: { pnpm: 'pnpm dlx "x"' } })
    expect(doc.children[3]).toMatchObject({ type: "updates", updates: [{ date: '2026 "Q3"' }] })
    expect(serializeMarkdown(doc)).toBe(markdown)
  })

  it("Copy page (resolveDemosToMarkdown) finds and rewrites escaped demo tags", async () => {
    const resolver: DemoResolver = {
      list: () => ["a/b"],
      meta: async () => ({ status: "Live" }),
      files: async () => [{ path: "index.tsx", content: "export default () => null\n" }],
      load: async () => () => null,
    }
    const markdown = '{% demo src="a/b" title="Quote \\" and %\\} inside" %}\n'
    const out = await resolveDemosToMarkdown(markdown, resolver)
    expect(out).toBe('{% demo src="a/b" title="Quote \\" and %\\} inside" status="Live" %}\n```tsx title="index.tsx"\nexport default () => null\n```\n{% enddemo %}\n')
    expect(parseMarkdown(out).children[0]).toMatchObject({ title: 'Quote " and %} inside', status: "Live" })
  })
})

describe("demo look attributes", () => {
  it("parse and serialize status, bleed, className, surface and variantsWidth", () => {
    const markdown =
      '{% demo src="a/b" status="Needs network" bleed="true" className="brand-surface dark" surface="background: url(\\"x;y.png\\"); --demo-gap: 12px" variantsWidth="16rem" %}\n'
    const [node] = parseMarkdown(markdown).children
    expect(node).toEqual({
      type: "demo",
      src: "a/b",
      status: "Needs network",
      bleed: true,
      className: "brand-surface dark",
      surface: 'background: url("x;y.png"); --demo-gap: 12px',
      variantsWidth: "16rem",
    })
    expect(serializeMarkdown(parseMarkdown(markdown))).toBe(markdown)
  })

  it('keeps bleed="false" (it overrides a meta.json bleed: true)', () => {
    const markdown = '{% demo src="a/b" bleed="false" %}\n'
    expect(parseMarkdown(markdown).children[0]).toMatchObject({ bleed: false })
    expect(serializeMarkdown(parseMarkdown(markdown))).toBe(markdown)
  })
})
