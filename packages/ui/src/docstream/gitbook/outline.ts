import type { Block, DocumentNode } from "./ast"
import { plainText } from "./inline"

/** Anchor id for a heading: `"Installation"` → `"installation"`. */
export function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "section"
  )
}

export interface OutlineEntry {
  level: number
  text: string
  /** The anchor id docstream renders for titled tab sets; hosts may reuse it for headings. */
  id: string
}

/**
 * The page's headings for a table of contents — Markdown headings plus the titles of
 * `{% tabs title="…" %}` sections — in document order (top level and inside hints,
 * tabs, steppers, columns and expandables).
 */
export function documentOutline(doc: DocumentNode | Block[]): OutlineEntry[] {
  const out: OutlineEntry[] = []
  const walk = (blocks: Block[]) => {
    for (const b of blocks) {
      if (b.type === "heading") {
        const text = plainText(b.children)
        if (text) out.push({ level: b.level, text, id: slugify(text) })
      } else if (b.type === "tabs") {
        if (b.title) out.push({ level: b.level ?? 2, text: b.title, id: slugify(b.title) })
        for (const t of b.tabs) walk(t.children)
      } else if (b.type === "hint" || b.type === "expandable") walk(b.children)
      else if (b.type === "stepper") for (const s of b.steps) walk(s.children)
      else if (b.type === "columns") for (const c of b.columns) walk(c.children)
    }
  }
  walk(Array.isArray(doc) ? doc : doc.children)
  return out
}
