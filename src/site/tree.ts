/* A docs site from a virtual file system: every Markdown file becomes a page, and the
   folder structure (or a GitBook `SUMMARY.md`) becomes the sidebar.

   Conventions, GitBook's where it has one:
   - `README.md` (or `index.md`) is its folder's page; the top-level one is the home page.
   - `SUMMARY.md` at the root, when present, *is* the sidebar: `## Group` headings and
     nested `* [Title](path.md)` lists. Pages it leaves out stay reachable by URL.
   - Without one, top-level folders become sidebar groups and deeper folders nest.
   - Numeric prefixes (`01-intro.md`, `2_guides/`) order entries and are dropped from URLs
     and titles. Frontmatter `order` overrides the prefix.
   - A page's title is, in order: its SUMMARY.md label, frontmatter `title`, its first
     `# heading`, then the file name (`quick-start.md` → "Quick start"). Frontmatter
     `description` is its lede and `hidden: true` keeps it out of the sidebar.
   - Every other file in the docs root is an asset (`tree.assets`): DocsSite serves it to the
     pages, so `![logo](images/logo.svg)` or an OpenAPI block's `[api](specs/api.json)` loads
     the file from the VFS.
   Everything here is pure (no React, no DOM), so a static build or a test can use it. */
import { parseDocument, isMap } from "yaml"

/** A file's contents: text, or a `Blob` for binary assets (images, models). Pages must be text. */
export type DocsFileContent = string | Blob

export type DocsFiles = Record<string, DocsFileContent> | ReadonlyArray<{ path: string; content: DocsFileContent }>

export interface DocsPage {
  /** Source path relative to the docs root, e.g. `01-guides/02-install.md`. */
  path: string
  /** URL path without leading slash: `guides/install`, `""` for the home page. */
  slug: string
  title: string
  description?: string
  /** The file as written (frontmatter included). */
  markdown: string
  /** The page body as the site renders it: no site-only frontmatter, no leading `# title`. */
  body: string
  /** Frontmatter (all keys), `{}` when there is none. */
  frontmatter: Record<string, unknown>
  hidden: boolean
  /** Titles of the sidebar groups/folders above the page, outermost first. */
  breadcrumbs: string[]
}

export type DocsNavItem =
  | { kind: "group"; title: string; children: DocsNavItem[] }
  | { kind: "page"; title: string; slug: string; children: DocsNavItem[] }
  | { kind: "folder"; title: string; children: DocsNavItem[] }
  | { kind: "link"; title: string; href: string }

export interface DocsTree {
  /** Every page, sidebar order first, then pages the sidebar leaves out. */
  pages: DocsPage[]
  /** Pages in reading order (what Previous / Next walk): listed, not hidden. */
  order: DocsPage[]
  nav: DocsNavItem[]
  bySlug: Map<string, DocsPage>
  byPath: Map<string, DocsPage>
  /** The common folder stripped from every input path (`"docs/"`), or `""`. */
  root: string
  /** Every non-Markdown file under the root, by path relative to it (`specs/api.json`). */
  assets: Map<string, DocsFileContent>
}

export interface BuildDocsTreeOptions {
  /** Folder to treat as the docs root; default: the deepest folder shared by every Markdown file. */
  root?: string
  /** Extra file filter, applied after the Markdown filter. */
  include?: (path: string) => boolean
  /** Use `SUMMARY.md` when there is one (default true). */
  summary?: boolean
  /** Sidebar title for a folder without a README, given its name with the prefix removed. */
  folderTitle?: (name: string, path: string) => string
}

/** Frontmatter keys that describe the page to the site rather than the reader. */
export const SITE_FRONTMATTER_KEYS = ["title", "description", "order", "hidden", "icon"] as const

const MARKDOWN = /\.(md|markdown|mdx)$/i
const INDEX = /^(readme|index)$/i
const PREFIX = /^(\d+)[-_. ]+(?=.)/

const isBlob = (v: unknown): v is Blob => typeof Blob !== "undefined" && v instanceof Blob

export function isMarkdownPath(path: string): boolean {
  return MARKDOWN.test(path)
}

/** `./docs//a/../b.md` → `docs/b.md`. Leading slashes and `.` segments are dropped. */
export function normalizePath(path: string): string {
  const out: string[] = []
  for (const part of path.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") continue
    if (part === "..") out.pop()
    else out.push(part)
  }
  return out.join("/")
}

/** `"03-quick-start"` → `{ name: "quick-start", order: 3 }`. */
export function stripOrderPrefix(name: string): { name: string; order?: number } {
  const m = PREFIX.exec(name)
  return m ? { name: name.slice(m[0].length), order: Number(m[1]) } : { name }
}

/** `"quick-start"` → `"Quick start"`; `"api_reference"` → `"Api reference"`. */
export function humanize(name: string): string {
  const words = name.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim()
  return words ? words[0]!.toUpperCase() + words.slice(1) : name
}

const segmentSlug = (segment: string) =>
  encodeURIComponent(stripOrderPrefix(segment).name.replace(/\s+/g, "-")).replace(/%2F/g, "/")

/** The URL slug for a source path: `01-guides/README.md` → `guides`, `README.md` → `""`. */
export function slugForPath(path: string): string {
  const parts = normalizePath(path).replace(MARKDOWN, "").split("/")
  if (INDEX.test(parts[parts.length - 1] ?? "")) parts.pop()
  return parts.map(segmentSlug).join("/")
}

/** Resolve `href` (as written in `fromPath`'s Markdown) against the docs root; null when external. */
export function resolveRelativePath(fromPath: string, href: string): { path: string; hash: string } | null {
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith("//")) return null
  const hashAt = href.indexOf("#")
  const raw = hashAt >= 0 ? href.slice(0, hashAt) : href
  const hash = hashAt >= 0 ? href.slice(hashAt + 1) : ""
  const clean = raw.split("?")[0]!
  let decoded = clean
  try {
    decoded = decodeURI(clean)
  } catch {
    // keep as written
  }
  if (!decoded) return { path: normalizePath(fromPath), hash }
  const dir = fromPath.includes("/") ? fromPath.slice(0, fromPath.lastIndexOf("/")) : ""
  const path = decoded.startsWith("/") ? normalizePath(decoded) : normalizePath(`${dir}/${decoded}`)
  return { path, hash }
}

interface Frontmatter {
  values: Record<string, unknown>
  /** Byte length of the `---` block (and the blank lines after it), 0 when absent. */
  length: number
}

const FRONTMATTER = /^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

export function readFrontmatter(markdown: string): Frontmatter {
  const m = FRONTMATTER.exec(markdown)
  if (!m) return { values: {}, length: 0 }
  let values: Record<string, unknown> = {}
  try {
    const doc = parseDocument(m[1]!)
    if (!doc.errors.length && isMap(doc.contents)) values = (doc.toJS() ?? {}) as Record<string, unknown>
  } catch {
    // Unreadable YAML stays in the body, where the property sheet reports it.
    return { values: {}, length: 0 }
  }
  const rest = markdown.slice(m[0].length)
  return { values, length: m[0].length + (rest.length - rest.replace(/^(?:[ \t]*\r?\n)+/, "").length) }
}

const H1 = /^#[ \t]+(.+?)[ \t]*#*[ \t]*$/
const FENCE = /^(`{3,}|~{3,})/

/** The first line that is a `# heading` before any other content, with its offsets. */
function leadingH1(body: string): { text: string; end: number } | null {
  let offset = 0
  for (const line of body.split("\n")) {
    const t = line.replace(/\r$/, "")
    if (t.trim() === "") {
      offset += line.length + 1
      continue
    }
    const m = H1.exec(t)
    if (!m) return null
    const after = body.slice(offset + line.length + 1)
    return { text: m[1]!, end: offset + line.length + 1 + (after.length - after.replace(/^(?:[ \t]*\r?\n)+/, "").length) }
  }
  return null
}

/** The first `# heading` anywhere outside code fences (for titles only). */
function firstH1(body: string): string | null {
  let fence: string | null = null
  for (const line of body.split("\n")) {
    const f = FENCE.exec(line.trim())
    if (f) {
      if (!fence) fence = f[1]![0]!
      else if (f[1]![0] === fence) fence = null
      continue
    }
    if (fence) continue
    const m = H1.exec(line.replace(/\r$/, ""))
    if (m) return m[1]!
  }
  return null
}

/** Inline Markdown in a heading → plain text for the sidebar and `<title>`. */
export function plainTitle(text: string): string {
  return text
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/(\*\*|__|\*|_|~~)(.+?)\1/g, "$2")
    .replace(/\\([\\`*_{}[\]()#+\-.!@])/g, "$1")
    .trim()
}

function toEntries(files: DocsFiles): Array<{ path: string; content: DocsFileContent }> {
  return Array.isArray(files)
    ? files.map((f) => ({ path: f.path, content: f.content }))
    : Object.entries(files as Record<string, DocsFileContent>).map(([path, content]) => ({ path, content }))
}

function commonRoot(paths: string[]): string {
  if (!paths.length) return ""
  const dirs = paths.map((p) => p.split("/").slice(0, -1))
  const first = dirs[0]!
  let n = first.length
  for (const d of dirs) {
    let i = 0
    while (i < n && i < d.length && d[i] === first[i]) i++
    n = i
  }
  return n ? `${first.slice(0, n).join("/")}/` : ""
}

interface Draft extends DocsPage {
  order?: number
  titleFromFile: boolean
}

function draftPage(path: string, markdown: string): Draft {
  const fm = readFrontmatter(markdown)
  const fmKeys = Object.keys(fm.values)
  const siteOnly = fmKeys.every((k) => (SITE_FRONTMATTER_KEYS as readonly string[]).includes(k))
  let body = siteOnly ? markdown.slice(fm.length) : markdown
  const fmTitle = typeof fm.values.title === "string" ? fm.values.title : undefined
  let title: string | undefined = fmTitle
  // The site renders the title itself, so a leading `# Title` leaves the body.
  if (siteOnly) {
    const h1 = leadingH1(body)
    if (h1) {
      title ??= plainTitle(h1.text)
      body = body.slice(h1.end)
    }
  }
  title ??= (() => {
    const h = firstH1(markdown.slice(fm.length))
    return h ? plainTitle(h) : undefined
  })()
  const parts = path.replace(MARKDOWN, "").split("/")
  const file = parts[parts.length - 1]!
  const named = INDEX.test(file) ? parts[parts.length - 2] : file
  const fromFile = !title
  title ??= named ? humanize(stripOrderPrefix(named).name) : "Home"
  const order = typeof fm.values.order === "number" ? fm.values.order : stripOrderPrefix(INDEX.test(file) ? (parts[parts.length - 2] ?? "") : file).order
  return {
    path,
    slug: slugForPath(path),
    title,
    description: typeof fm.values.description === "string" ? fm.values.description : undefined,
    markdown,
    body,
    frontmatter: fm.values,
    hidden: fm.values.hidden === true,
    breadcrumbs: [],
    order,
    titleFromFile: fromFile,
  }
}

interface FolderNode {
  name: string
  path: string
  index?: Draft
  pages: Draft[]
  folders: Map<string, FolderNode>
}

const byOrder = <T extends { order?: number; title: string; isIndex?: boolean }>(a: T, b: T) =>
  (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY) || a.title.localeCompare(b.title)

function folderTree(drafts: Draft[]): FolderNode {
  const root: FolderNode = { name: "", path: "", pages: [], folders: new Map() }
  for (const d of drafts) {
    const parts = d.path.split("/")
    const file = parts.pop()!
    let node = root
    for (const part of parts) {
      let next = node.folders.get(part)
      if (!next) {
        next = { name: part, path: node.path ? `${node.path}/${part}` : part, pages: [], folders: new Map() }
        node.folders.set(part, next)
      }
      node = next
    }
    if (INDEX.test(file.replace(MARKDOWN, "")) && !node.index) node.index = d
    else node.pages.push(d)
  }
  return root
}

function autoNav(root: FolderNode, folderTitle: (name: string, path: string) => string): DocsNavItem[] {
  const folderItem = (f: FolderNode, crumbs: string[]): { item: DocsNavItem; order?: number; title: string } => {
    const title = f.index && !f.index.titleFromFile ? f.index.title : folderTitle(stripOrderPrefix(f.name).name, f.path)
    const children = entries(f, [...crumbs, title])
    if (f.index) f.index.breadcrumbs = crumbs
    const order = (f.index?.frontmatter.order as number | undefined) ?? stripOrderPrefix(f.name).order
    return {
      item: f.index && !f.index.hidden ? { kind: "page", title, slug: f.index.slug, children } : { kind: "folder", title, children },
      order,
      title,
    }
  }
  const entries = (f: FolderNode, crumbs: string[]): DocsNavItem[] => {
    const list: Array<{ item: DocsNavItem; order?: number; title: string }> = []
    for (const p of f.pages) {
      p.breadcrumbs = crumbs
      if (!p.hidden) list.push({ item: { kind: "page", title: p.title, slug: p.slug, children: [] }, order: p.order, title: p.title })
    }
    for (const sub of f.folders.values()) {
      const e = folderItem(sub, crumbs)
      if (e.item.kind === "page" || (e.item.kind === "folder" && e.item.children.length)) list.push(e)
    }
    return list.sort(byOrder).map((e) => e.item)
  }

  const top: DocsNavItem[] = []
  if (root.index) {
    root.index.breadcrumbs = []
    if (!root.index.hidden) top.push({ kind: "page", title: root.index.title, slug: root.index.slug, children: [] })
  }
  // Loose top-level pages come first, then one group per top-level folder.
  const loose: Array<{ item: DocsNavItem; order?: number; title: string }> = []
  for (const p of root.pages) {
    p.breadcrumbs = []
    if (!p.hidden) loose.push({ item: { kind: "page", title: p.title, slug: p.slug, children: [] }, order: p.order, title: p.title })
  }
  top.push(...loose.sort(byOrder).map((e) => e.item))
  const groups = [...root.folders.values()]
    .map((f) => {
      const title = f.index && !f.index.titleFromFile ? f.index.title : folderTitle(stripOrderPrefix(f.name).name, f.path)
      const children = entries(f, [title])
      if (f.index) {
        f.index.breadcrumbs = [title]
        if (!f.index.hidden) children.unshift({ kind: "page", title: "Overview", slug: f.index.slug, children: [] })
      }
      return { item: { kind: "group", title, children } as DocsNavItem, order: (f.index?.frontmatter.order as number | undefined) ?? stripOrderPrefix(f.name).order, title }
    })
    .filter((g) => g.item.kind === "group" && g.item.children.length)
    .sort(byOrder)
  top.push(...groups.map((g) => g.item))
  return top
}

const LIST_ITEM = /^(\s*)[*+-][ \t]+\[([^\]]*)\]\(([^)\s]*)(?:\s+"[^"]*")?\)\s*$/
const GROUP = /^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/

/** GitBook's SUMMARY.md: `## Group` headings, nested `* [Title](path.md)` lists, `---` ignored. */
function summaryNav(summary: string, summaryPath: string, byPath: Map<string, Draft>): DocsNavItem[] {
  const top: DocsNavItem[] = []
  let group: { kind: "group"; title: string; children: DocsNavItem[] } | null = null
  const stack: Array<{ indent: number; children: DocsNavItem[]; crumbs: string[] }> = []
  let firstHeading = true
  for (const line of summary.split("\n")) {
    const t = line.replace(/\r$/, "")
    const g = GROUP.exec(t)
    if (g) {
      // The first `# Table of contents` heading is the file's own title, not a group.
      if (firstHeading && /^#\s/.test(t) && /contents|summary/i.test(g[1]!)) {
        firstHeading = false
        continue
      }
      firstHeading = false
      group = { kind: "group", title: plainTitle(g[1]!), children: [] }
      top.push(group)
      stack.length = 0
      continue
    }
    const m = LIST_ITEM.exec(t)
    if (!m) continue
    firstHeading = false
    const indent = m[1]!.replace(/\t/g, "  ").length
    const label = plainTitle(m[2]!)
    const href = m[3]!
    while (stack.length && stack[stack.length - 1]!.indent >= indent) stack.pop()
    const parent = stack[stack.length - 1]
    const siblings = parent ? parent.children : group ? group.children : top
    const crumbs = parent ? parent.crumbs : group ? [group.title] : []
    const resolved = resolveRelativePath(summaryPath, href)
    const page = resolved ? byPath.get(resolved.path) : undefined
    let item: DocsNavItem
    if (page) {
      page.title = label || page.title
      page.breadcrumbs = crumbs
      item = { kind: "page", title: page.title, slug: page.slug, children: [] }
    } else if (!href || !resolved) {
      item = href ? { kind: "link", title: label, href } : { kind: "folder", title: label, children: [] }
    } else {
      continue
    }
    siblings.push(item)
    if (item.kind === "page" || item.kind === "folder") stack.push({ indent, children: item.children, crumbs: [...crumbs, label] })
  }
  return top
}

function walkPages(nav: DocsNavItem[], bySlug: Map<string, DocsPage>, out: DocsPage[] = []): DocsPage[] {
  for (const item of nav) {
    if (item.kind === "page") {
      const p = bySlug.get(item.slug)
      if (p && !out.includes(p)) out.push(p)
    }
    if (item.kind !== "link") walkPages(item.children, bySlug, out)
  }
  return out
}

/** Build pages and the sidebar from a set of files. Non-Markdown files are ignored. */
export function buildDocsTree(files: DocsFiles, options: BuildDocsTreeOptions = {}): DocsTree {
  const all = toEntries(files)
    .map((f) => ({ path: normalizePath(f.path), content: f.content }))
    .filter((f) => !options.include || options.include(f.path))
  const entries = all.filter((f): f is { path: string; content: string } => isMarkdownPath(f.path) && typeof f.content === "string")
  const root = options.root !== undefined ? (normalizePath(options.root) ? `${normalizePath(options.root)}/` : "") : commonRoot(entries.map((f) => f.path))
  const inRoot = entries.filter((f) => f.path.startsWith(root)).map((f) => ({ path: f.path.slice(root.length), content: f.content }))
  const assets = new Map<string, DocsFileContent>()
  for (const f of all) {
    if (!isMarkdownPath(f.path) && f.path.startsWith(root) && (typeof f.content === "string" || isBlob(f.content))) {
      assets.set(f.path.slice(root.length), f.content)
    }
  }

  const summaryFile = options.summary === false ? undefined : inRoot.find((f) => /^summary\.md$/i.test(f.path))
  const drafts = inRoot.filter((f) => f !== summaryFile).map((f) => draftPage(f.path, f.content))
  const byPath = new Map(drafts.map((d) => [d.path, d]))
  const folderTitle = options.folderTitle ?? ((name: string) => humanize(name))

  const nav = summaryFile ? summaryNav(summaryFile.content, summaryFile.path, byPath) : autoNav(folderTree(drafts), folderTitle)

  const bySlug = new Map<string, Draft>()
  for (const d of drafts) if (!bySlug.has(d.slug)) bySlug.set(d.slug, d)
  const listed = walkPages(nav, bySlug) as Draft[]
  const pages: DocsPage[] = [...listed, ...drafts.filter((d) => !listed.includes(d))].map(
    ({ order: _order, titleFromFile: _fromFile, ...page }) => page,
  )
  // Keep the maps pointing at the cleaned objects.
  const finalBySlug = new Map<string, DocsPage>()
  const finalByPath = new Map<string, DocsPage>()
  for (const p of pages) {
    if (!finalBySlug.has(p.slug)) finalBySlug.set(p.slug, p)
    finalByPath.set(p.path, p)
  }
  const order = listed.map((p) => finalBySlug.get(p.slug)!).filter((p) => !p.hidden)
  return { pages, order, nav, bySlug: finalBySlug, byPath: finalByPath, root, assets }
}

/** The asset (non-Markdown file) `href` names from `from`, with its root-relative path; null when none. */
export function findLinkedAsset(tree: DocsTree, from: DocsPage, href: string): { path: string; content: DocsFileContent } | null {
  const resolved = resolveRelativePath(from.path, href)
  if (!resolved) return null
  const content = tree.assets.get(resolved.path)
  return content === undefined ? null : { path: resolved.path, content }
}

/** The page `href` points at from `from` — a relative `.md` path, a folder, or a slug. */
export function findLinkedPage(tree: DocsTree, from: DocsPage, href: string): { page: DocsPage; hash: string } | null {
  const resolved = resolveRelativePath(from.path, href)
  if (!resolved) return null
  const { path, hash } = resolved
  if (!href.split("#")[0]) return { page: from, hash }
  const direct =
    tree.byPath.get(path) ??
    tree.byPath.get(`${path}/README.md`) ??
    tree.byPath.get(`${path}/readme.md`) ??
    tree.byPath.get(`${path}/index.md`) ??
    tree.bySlug.get(path) ??
    tree.bySlug.get(slugForPath(path))
  return direct ? { page: direct, hash } : null
}
