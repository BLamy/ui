/* "Copy a docs page, paste it into the editor, get the same page back": byte-stable round trips. */
// @ts-ignore node's types aren't installed; only this function is needed.
import { readFileSync as untypedReadFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { parseMarkdown, type Block, type DocumentNode } from "@brett_lamy/docstream/gitbook"
import { resolveDemosToMarkdown, type DemoResolver } from "@brett_lamy/docstream/demo"
import { astToTiptap, serializeEditorMarkdown, tiptapToAst, type PMNode } from "./convert"
import { getGitbookSchema } from "./extensions"

const readFileSync = untypedReadFileSync as (url: URL, encoding: "utf8") => string

/** docstream's representative docs page (every block type docs sites use, canonical form). */
const page = readFileSync(new URL("./__fixtures__/docs-page.md", import.meta.url), "utf8")

const schema = getGitbookSchema()

/**
 * markdown → AST → editor JSON → ProseMirror document (through the real schema, so
 * unknown attrs are dropped and adjacent text is merged, as in the live editor) →
 * editor JSON → AST → markdown, carrying citations the way `GitbookEditor` does.
 */
function throughEditor(markdown: string): string {
  const doc = parseMarkdown(markdown)
  const node = schema.nodeFromJSON(astToTiptap(doc))
  node.check()
  const ast: DocumentNode = tiptapToAst(node.toJSON() as PMNode)
  if (doc.citations?.length) ast.citations = doc.citations
  return serializeEditorMarkdown(ast)
}

const FILES: Record<string, { path: string; content: string; language?: string }[]> = {
  "button/sizes": [
    { path: "index.tsx", content: 'import { Button } from "@brett_lamy/ui"\n\nexport default function Sizes({ variant }: { variant?: string }) {\n  return <Button size={variant}>Save</Button>\n}\n', language: "tsx" },
    { path: "sizes.css", content: ".row { display: flex }\n", language: "css" },
  ],
  "button/ghost": [{ path: "index.tsx", content: "export default () => <button>Ghost</button>\n", language: "tsx" }],
}

const resolver: DemoResolver = {
  list: () => Object.keys(FILES),
  meta: async (src) => (src === "button/ghost" ? { title: "Ghost button", height: 240, variants: [{ id: "a", label: "A" }] } : undefined),
  files: async (src) => {
    if (!FILES[src]) throw new Error(`unknown ${src}`)
    return FILES[src]
  },
  load: async () => () => null,
}

function blockTypes(blocks: Block[]): string[] {
  return blocks.flatMap((b) => [
    b.type,
    ...(b.type === "tabs" ? b.tabs.flatMap((t) => blockTypes(t.children)) : []),
  ])
}

describe("a full docs page through the editor", () => {
  it("round-trips byte-for-byte", () => {
    expect(throughEditor(page)).toBe(page)
    // Every block kind of the page is in the fixture, so none is silently skipped.
    expect(new Set(blockTypes(parseMarkdown(page).children))).toEqual(
      new Set([
        "heading", "paragraph", "tabs", "command", "hint", "code", "demo", "table", "source-ref", "stepper",
        "columns", "expandable", "list", "blockquote", "divider", "math", "figure", "embed", "content-ref",
        "updates", "openapi-operation",
      ])
    )
  })

  it("round-trips the page's Copy-page output (demos with their files inline) byte-for-byte", async () => {
    const copied = await resolveDemosToMarkdown(page, resolver)
    expect(copied).not.toBe(page)
    expect(copied.match(/\{% enddemo %\}/g)?.length).toBe(3)
    expect(throughEditor(copied)).toBe(copied)
  })

  it("is stable when edited again (a second trip changes nothing)", async () => {
    const copied = await resolveDemosToMarkdown(page, resolver)
    expect(throughEditor(throughEditor(copied))).toBe(copied)
  })
})
