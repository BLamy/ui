/* Client-side full-text search over a docs tree: each page is split into sections at its
   headings, so a hit can jump straight to the heading it was found under. */
import { slugify } from "../gitbook/outline"
import { plainTitle, type DocsPage, type DocsTree } from "./tree"

export interface DocsSearchSection {
  page: DocsPage
  /** The heading this section starts at; undefined for the text before the first heading. */
  heading?: string
  /** The heading's anchor id. */
  anchor?: string
  text: string
}

export interface DocsSearchResult {
  page: DocsPage
  heading?: string
  anchor?: string
  /** A short excerpt around the first match, or the section's opening words. */
  snippet: string
  /** [start, end) of the match inside `snippet`, when the match is in the text. */
  highlight?: [number, number]
  score: number
}

export interface DocsSearchIndex {
  sections: DocsSearchSection[]
  search(query: string, limit?: number): DocsSearchResult[]
}

const HEADING = /^(#{1,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/
const TABS_TITLE = /^\{%\s*tabs\b[^%]*\btitle="([^"]+)"/

/** Markdown → searchable plain text (tags, HTML and punctuation removed, code kept). */
export function searchableText(markdown: string): string {
  return markdown
    .replace(/^(`{3,}|~{3,}).*$/gm, " ")
    .replace(/\{%[^%]*%\}/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/^\[\^[^\]]+\]:.*$/gm, " ")
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/[*~`>|#]+/g, " ")
    // `_` only as emphasis at a word's edge, so `@brett_lamy` and `snake_case` stay whole.
    .replace(/(^|[\s(])_+|_+(?=[\s).,;:!?]|$)/g, "$1 ")
    .replace(/^\s*[-+]\s+(\[.\]\s+)?/gm, " ")
    .replace(/\$\$/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function sectionsOf(page: DocsPage): DocsSearchSection[] {
  const out: DocsSearchSection[] = []
  let heading: string | undefined
  let buf: string[] = []
  let fence: string | null = null
  const flush = () => {
    const text = searchableText(buf.join("\n"))
    if (text || heading) out.push({ page, heading, anchor: heading ? slugify(heading) : undefined, text })
    buf = []
  }
  for (const line of page.body.split("\n")) {
    const trimmed = line.trim()
    const f = /^(`{3,}|~{3,})/.exec(trimmed)
    if (f) {
      if (!fence) fence = f[1]![0]!
      else if (f[1]![0] === fence) fence = null
      buf.push(line)
      continue
    }
    const h = fence ? null : HEADING.exec(line) ?? TABS_TITLE.exec(trimmed)
    if (h) {
      flush()
      heading = plainTitle(h.length === 3 ? h[2]! : h[1]!)
      continue
    }
    buf.push(line)
  }
  flush()
  return out
}

function snippetAround(text: string, at: number, length: number): { snippet: string; highlight?: [number, number] } {
  if (at < 0) return { snippet: text.length > 140 ? `${text.slice(0, 140).trimEnd()}…` : text }
  const start = Math.max(0, at - 50)
  const end = Math.min(text.length, at + length + 90)
  const lead = start > 0 ? "…" : ""
  const snippet = `${lead}${text.slice(start, end).trim()}${end < text.length ? "…" : ""}`
  const offset = lead.length + (at - start) - (text.slice(start, end).length - text.slice(start, end).trimStart().length)
  return { snippet, highlight: [offset, offset + length] }
}

/** An in-memory index of every page; `search` ranks title, then heading, then body matches. */
export function createDocsSearchIndex(tree: DocsTree): DocsSearchIndex {
  const sections = tree.pages.flatMap(sectionsOf)
  return {
    sections,
    search(query, limit = 20) {
      const q = query.trim().toLowerCase()
      if (!q) return []
      const terms = q.split(/\s+/).filter(Boolean)
      const results: DocsSearchResult[] = []
      for (const s of sections) {
        const title = s.page.title.toLowerCase()
        const heading = s.heading?.toLowerCase() ?? ""
        const text = s.text.toLowerCase()
        const haystack = `${title} ${heading} ${text}`
        if (!terms.every((t) => haystack.includes(t))) continue
        let score = 0
        for (const t of terms) {
          if (title.startsWith(t)) score += 12
          else if (title.includes(t)) score += 8
          if (heading.startsWith(t)) score += 6
          else if (heading.includes(t)) score += 4
          if (text.includes(t)) score += 1
        }
        if (title === q) score += 20
        if (heading === q) score += 10
        // A page's opening section carries its title match; deeper sections rank by their heading.
        if (s.heading) score -= title.includes(terms[0]!) ? 6 : 0
        const at = text.indexOf(terms[0]!)
        results.push({ page: s.page, heading: s.heading, anchor: s.anchor, score, ...snippetAround(s.text, at, at >= 0 ? terms[0]!.length : 0) })
      }
      results.sort((a, b) => b.score - a.score)
      const seen = new Set<string>()
      const out: DocsSearchResult[] = []
      for (const r of results) {
        const key = `${r.page.slug}#${r.anchor ?? ""}`
        if (seen.has(key)) continue
        seen.add(key)
        out.push(r)
        if (out.length >= limit) break
      }
      return out
    },
  }
}
