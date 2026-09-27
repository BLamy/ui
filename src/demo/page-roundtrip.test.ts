import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import type { Block, DemoNode } from "../gitbook/ast"
import { parseMarkdown } from "../gitbook/parse"
import { serializeMarkdown } from "../gitbook/serialize"
import { resolveDemosToMarkdown } from "./markdown"
import type { DemoResolver } from "./types"

/** A representative docs page: every block type docs sites use, in canonical form. */
const page = readFileSync(new URL("../gitbook/__fixtures__/docs-page.md", import.meta.url), "utf8")

function demos(blocks: Block[]): DemoNode[] {
  const out: DemoNode[] = []
  for (const b of blocks) {
    if (b.type === "demo") out.push(b)
    else if (b.type === "tabs") for (const t of b.tabs) out.push(...demos(t.children))
    else if ("children" in b && Array.isArray(b.children) && b.type !== "paragraph" && b.type !== "heading" && b.type !== "content-ref") {
      out.push(...demos(b.children as Block[]))
    }
  }
  return out
}

const resolver: DemoResolver = {
  list: () => ["button/sizes", "button/ghost"],
  meta: async (src) => (src === "button/ghost" ? { title: "Ghost button" } : undefined),
  files: async (src) => {
    if (src === "button/sizes") {
      return [
        { path: "index.tsx", content: 'import { Button } from "@brett_lamy/ui"\n\nexport default function Sizes({ variant }: { variant?: string }) {\n  return <Button size={variant}>Save</Button>\n}\n', language: "tsx" },
        { path: "sizes.css", content: ".row { display: flex }\n", language: "css" },
      ]
    }
    if (src === "button/ghost") return [{ path: "index.tsx", content: "export default () => <button>Ghost</button>\n", language: "tsx" }]
    throw new Error(`unknown ${src}`)
  },
  load: async () => () => null,
}

describe("a full docs page", () => {
  it("parse → serialize is byte-stable", () => {
    const doc = parseMarkdown(page)
    expect(serializeMarkdown(doc)).toBe(page)
    // …and the AST survives a second trip unchanged.
    expect(parseMarkdown(serializeMarkdown(doc))).toEqual(doc)
    expect(doc.children.map((b) => b.type)).toEqual(expect.arrayContaining([
      "heading", "paragraph", "tabs", "hint", "code", "demo", "table", "source-ref", "stepper", "columns",
      "expandable", "list", "blockquote", "divider", "math", "figure", "embed", "content-ref", "updates", "openapi-operation",
    ]))
    expect(doc.citations).toEqual([{ id: "1", url: "https://example.com/buttons", label: "Button guidelines" }])
  })

  it("Copy page output renders back: every demo carries the right files, everything else is untouched", async () => {
    const copied = await resolveDemosToMarkdown(page, resolver)
    const doc = parseMarkdown(copied)
    const found = demos(doc.children)
    expect(found.map((d) => [d.src, d.files?.map((f) => f.path)])).toEqual([
      ["button/sizes", ["index.tsx", "sizes.css"]],
      ["composer/scroll-fab", ["index.tsx", "data.ts", "README.md"]],
      ["button/ghost", ["index.tsx"]],
    ])
    expect(found[0]).toMatchObject({ title: "Sizes", height: "320", variants: [{ id: "sm", label: "Small" }, { id: "lg", label: "Large" }] })
    expect(found[0].files?.[0].content).toBe('import { Button } from "@brett_lamy/ui"\n\nexport default function Sizes({ variant }: { variant?: string }) {\n  return <Button size={variant}>Save</Button>\n}')
    expect(found[2]).toMatchObject({ title: "Ghost button" })
    expect(found.some((d) => d.open)).toBe(false)
    // Parsing the copy and serializing it again gives the copy back.
    expect(serializeMarkdown(doc)).toBe(copied)
    // Outside the demos, the page is unchanged.
    const bare = (blocks: Block[]): Block[] =>
      blocks.map((b) =>
        b.type === "demo"
          ? ({ type: "demo", src: b.src } as DemoNode)
          : b.type === "tabs"
            ? { ...b, tabs: b.tabs.map((t) => ({ ...t, children: bare(t.children) })) }
            : b,
      )
    expect(bare(doc.children)).toEqual(bare(parseMarkdown(page).children))
    // And copying the copy is a no-op.
    await expect(resolveDemosToMarkdown(copied, resolver)).resolves.toBe(copied)
  })
})
