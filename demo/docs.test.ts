/* The docs site's own rules, enforced: every page in demo/docs parses, round-trips byte for
   byte, uses no tag docstream would silently drop, links only to pages that exist, and every
   `{% demo src %}` without inline files has a folder under src/examples. */
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join, relative } from "node:path"
import { describe, expect, it } from "vitest"
import { parseMarkdown } from "../src/gitbook/parse"
import { serializeMarkdown } from "../src/gitbook/serialize"
import { buildDocsTree, findLinkedPage } from "../src/site/tree"

const docsRoot = join(__dirname, "docs")
const examplesRoot = join(__dirname, "src/examples")

const files = (readdirSync(docsRoot, { recursive: true, encoding: "utf8" }) as string[])
  .filter((p) => p.endsWith(".md"))
  .map((p) => ({ path: p.split("\\").join("/"), content: readFileSync(join(docsRoot, p), "utf8") }))
const tree = buildDocsTree(files)

/** Every node of the AST, depth first. */
function* nodes(value: unknown): Generator<Record<string, unknown>> {
  if (Array.isArray(value)) for (const v of value) yield* nodes(v)
  else if (value && typeof value === "object") {
    const node = value as Record<string, unknown>
    if (typeof node.type === "string") yield node
    for (const [key, child] of Object.entries(node)) if (key !== "properties") yield* nodes(child)
  }
}

/** Markdown links outside code: fences, indented code and inline code are blanked first. */
function links(markdown: string): string[] {
  const prose = markdown
    .replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1[ \t]*$/gm, "")
    .replace(/``[^`]*``|`[^`\n]*`|<code>[\s\S]*?<\/code>/g, "")
  const out = [...prose.matchAll(/(?<!\\)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]!)
  out.push(...[...prose.matchAll(/\b(?:href|url)="([^"]+)"/g)].map((m) => m[1]!))
  return out.filter((href) => !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(href) && !href.startsWith("?"))
}

describe("demo/docs", () => {
  it("has pages", () => {
    expect(tree.pages.length).toBeGreaterThan(20)
    expect(tree.bySlug.get("")).toBeDefined()
  })

  for (const page of tree.pages) {
    describe(page.path, () => {
      const doc = parseMarkdown(page.markdown)

      it("round-trips byte for byte", () => {
        expect(serializeMarkdown(doc)).toBe(page.markdown)
      })

      it("has no unparsed or unknown tags", () => {
        for (const node of nodes(doc.children)) {
          if (node.type === "raw") throw new Error(`unknown tag, dropped when rendered: ${String(node.markdown)}`)
          if (node.type === "paragraph") {
            const prose = (node.children as Array<{ type: string; text?: string; code?: boolean }>)
              .filter((c) => c.type === "text" && !c.code)
              .map((c) => c.text)
              .join("")
            expect(prose, `${page.path}: a {% tag %} that didn't parse`).not.toMatch(/\{%\s*[a-z-]+[^%]*%\}/)
          }
        }
      })

      it("links to pages that exist", () => {
        for (const href of links(page.markdown)) {
          if (/\.(png|jpe?g|gif|svg|webp|mp4|webm|stl|rrweb|json|ya?ml|strudel|txt)(#|$)/i.test(href)) continue
          expect(findLinkedPage(tree, page, href), `${page.path} → ${href}`).not.toBeNull()
        }
      })

      it("has a folder for every file-backed demo", () => {
        for (const node of nodes(doc.children)) {
          if (node.type !== "demo" || (Array.isArray(node.files) && node.files.length)) continue
          const folder = join(examplesRoot, String(node.src))
          expect(existsSync(folder), `${page.path}: {% demo src="${String(node.src)}" %} → ${relative(__dirname, folder)}`).toBe(true)
        }
      })
    })
  }
})
