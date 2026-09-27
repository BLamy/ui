/* The docs' pages are plain docstream Markdown files (apps/docs/pages/<id>.md) that embed live examples with
   `{% demo src="<page>/<example>" %}` block tags. This module is pure (no Vite, no DOM, erasable TS only) so the
   browser ("Copy page") and Node (tools/docs/pages-md.mjs → md/<id>.md, llms.txt) share one implementation. */

export interface NavPage {
  id: string
  title: string
  /** Wide page layout (the Blocks gallery). */
  wide?: boolean
}
export interface NavSection {
  section: string
  pages: NavPage[]
}
export interface Nav {
  /** The sidebar, in reading order. */
  sections: NavSection[]
  /** Pages outside the sidebar list (the top-level Blocks page). */
  standalone: Array<NavPage & { section: string }>
}

export interface PageInfo extends NavPage {
  section: string
}

/** Every page in order: the sidebar's, then the standalone ones. */
export function pageList(nav: Nav): PageInfo[] {
  return [
    ...nav.sections.flatMap((s) => s.pages.map((p) => ({ ...p, section: s.section }))),
    ...nav.standalone,
  ]
}

/** A `{% demo … %}` tag on its own line. */
const DEMO_LINE = /^\{%\s*demo\s+(.*?)\s*%\}\s*$/

/** `src="a/b" layout="multi"` → { src: 'a/b', layout: 'multi' }. */
export function parseAttrs(s: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g
  for (let m = re.exec(s); m; m = re.exec(s)) out[m[1]] = m[2] ?? m[3] ?? m[4] ?? ''
  return out
}

export type Segment =
  | { kind: 'markdown'; text: string }
  | { kind: 'demo'; src: string; attrs: Record<string, string> }

/** Splits a page at its top-level demo tags (tags inside code fences are left alone). */
export function splitDemos(md: string): Segment[] {
  const out: Segment[] = []
  let buf: string[] = []
  let fence: string | null = null
  const flush = () => {
    const text = buf.join('\n').trim()
    if (text) out.push({ kind: 'markdown', text })
    buf = []
  }
  for (const line of md.split('\n')) {
    const f = line.match(/^\s*(`{3,}|~{3,})/)
    if (f) fence = fence ? (f[1].startsWith(fence) ? null : fence) : f[1]
    const m = fence ? null : line.match(DEMO_LINE)
    if (!m) {
      buf.push(line)
      continue
    }
    flush()
    const attrs = parseAttrs(m[1])
    out.push({ kind: 'demo', src: attrs.src ?? '', attrs })
  }
  flush()
  return out
}

/** A demo's readable source for plain-text output: its title and every file, entry first. */
export interface DemoText {
  title: string
  files: Array<[name: string, code: string]>
}

const lang = (file: string) => file.split('.').pop() || 'text'

function fence(code: string, info: string) {
  const ticks = code.includes('```') ? '````' : '```'
  return `${ticks}${info}\n${code.replace(/\n+$/, '')}\n${ticks}`
}

/** One demo as Markdown: a bold title, then each file as a fenced block headed by its name. */
export function demoMarkdown(src: string, demo: DemoText | undefined): string {
  if (!demo) return `> Missing example: \`${src}\``
  const parts = [`**Example — ${demo.title}**`]
  for (const [name, code] of demo.files) {
    if (demo.files.length > 1) parts.push(`\`${name}\``)
    parts.push(fence(code, `${lang(name)} title="${name}"`))
  }
  return parts.join('\n\n')
}

export interface PageMarkdownOptions {
  page: PageInfo
  siteUrl: string
  /** Is `id` a docs page (so `](#id)` links become absolute)? */
  isPage: (id: string) => boolean
  demo: (src: string) => DemoText | undefined
}

export const pageUrl = (siteUrl: string, id: string) => `${siteUrl}/#/${id}`
export const pageMdPath = (id: string) => `md/${id}.md`

/** A page as self-contained Markdown: each demo tag replaced by the example's files, internal links made absolute. */
export function pageMarkdown(md: string, o: PageMarkdownOptions): string {
  const body = splitDemos(md)
    .map((s) => (s.kind === 'markdown' ? s.text : demoMarkdown(s.src, o.demo(s.src))))
    .join('\n\n')
    .replace(/\]\(#([\w-]+)\)/g, (m, target: string) => (o.isPage(target) ? `](${pageUrl(o.siteUrl, target)})` : m))
  return `${body.trim()}\n\n---\n\nSource: ${pageUrl(o.siteUrl, o.page.id)} · BL UI (${o.page.section})\n`
}
