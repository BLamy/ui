/* DocsSite — a GitBook-style documentation site from a folder of Markdown files.

   Hand it every file you have (`import.meta.glob("./docs/**", { query: "?raw", eager: true })`,
   a fetched repo tree, an in-memory VFS); it keeps the Markdown, builds the sidebar from the
   folders (or SUMMARY.md), and renders each page through docstream with a header, search
   (⌘K), an "On this page" outline, breadcrumbs, previous / next and "Copy page".
   Relative `.md` links between pages navigate in place. Routing is the URL hash by default
   (static hosting needs no rewrites), the History API with `routing="history"`, or in-memory
   with `routing="memory"` for a site embedded in another page. */
import {
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react"
import { ArrowLeft, ArrowRight, ChevronRight, FileText, Hash, Menu, Moon, PencilLine, Search, Sun, X } from "lucide-react"

import { AssetResolverContext, AssetResolverProvider, type AssetResolver } from "../asset-resolver"
import { MarkdownContent, type DocRenderOptions, type LivePreviewRenderer, type SourceReferenceRenderer } from "../docs/DocsRenderer"
import { DocPageActions, type DocPageActionsOptions } from "../docs/PageActions"
import { documentOutline, type OutlineEntry } from "../gitbook/outline"
import { parseMarkdown } from "../gitbook/parse"
import { createDocsSearchIndex, type DocsSearchResult } from "./search"
import { buildDocsTree, findLinkedAsset, findLinkedPage, type BuildDocsTreeOptions, type DocsFileContent, type DocsFiles, type DocsNavItem, type DocsPage, type DocsTree } from "./tree"

export type DocsSiteRouting = "hash" | "history" | "memory"
export type DocsSiteTheme = "light" | "dark"

export interface DocsSiteLink {
  label: string
  href: string
  icon?: ReactNode
}

export interface DocsSiteProps extends Omit<DocRenderOptions, "pageActions"> {
  /** The files to publish: `{ path: content }` or `[{ path, content }]`. Only Markdown is kept. */
  files?: DocsFiles
  /** A tree you built yourself with `buildDocsTree` (wins over `files`). */
  tree?: DocsTree
  treeOptions?: BuildDocsTreeOptions
  /** Site name, in the header and the browser tab. */
  title?: string
  /** Mark shown before the title. */
  logo?: ReactNode
  /** Header links (GitHub, npm, …). */
  links?: DocsSiteLink[]
  /** `"hash"` (default): `#/guides/install`. `"history"`: real paths under `basePath`. `"memory"`: no URL. */
  routing?: DocsSiteRouting
  /** URL prefix for `routing="history"` (e.g. `"/docs"`). */
  basePath?: string
  /** First page for `routing="memory"` (a slug, e.g. `"guides/install"`). */
  initialPath?: string
  /** Called after every navigation. */
  onNavigate?: (page: DocsPage, hash: string) => void
  /** Controlled theme. */
  theme?: DocsSiteTheme
  /** Uncontrolled starting theme (default `"system"`). */
  defaultTheme?: DocsSiteTheme | "system"
  onThemeChange?: (theme: DocsSiteTheme) => void
  /** Show the light / dark switch (default true). */
  themeToggle?: boolean
  /** localStorage key for the reader's theme choice; `false` to not persist (default `"docstream-site-theme"`). */
  themeStorageKey?: string | false
  /** Where `data-theme` goes: the whole document (default, unless memory routing) or just the site. */
  applyThemeTo?: "document" | "site"
  /** Use docstream's built-in light / dark colors (default true). Turn off when your app defines shadcn-style tokens. */
  palette?: boolean
  /** Brand color for links, active items and focus rings. */
  accentColor?: string
  /** ⌘K full-text search (default true). */
  search?: boolean
  /** The "On this page" outline (default true). */
  toc?: boolean
  /** "Copy page ▾" in each page header (default true). A function decides per page. */
  pageActions?: boolean | DocPageActionsOptions | ((page: DocsPage) => boolean | DocPageActionsOptions)
  /** "Edit this page" link, e.g. `(p) => \`https://github.com/me/repo/edit/main/docs/${p.path}\``. */
  editUrl?: (page: DocsPage) => string | undefined
  /** Below the sidebar navigation. */
  sidebarFooter?: ReactNode
  /** Below every page. */
  footer?: ReactNode
  /** Wrap or extend a page's rendered content. */
  renderPage?: (page: DocsPage, content: ReactNode) => ReactNode
  /** Content for an unknown path. */
  notFound?: (path: string) => ReactNode
  /** Keep `document.title` in sync (`"Page — Site"`, default unless memory routing), or format it yourself. */
  documentTitle?: boolean | ((page: DocsPage, siteTitle: string | undefined) => string)
  /** The site's height; it scrolls inside. Default `100dvh` — give an embedded site a fixed height. */
  height?: number | string
  liveRenderer?: LivePreviewRenderer
  sourceRenderer?: SourceReferenceRenderer
  className?: string
  style?: CSSProperties
}

interface Location {
  slug: string
  hash: string
  /** Bumped on every navigation so re-clicking the same anchor scrolls again. */
  key: number
}

const trimSlashes = (s: string) => s.replace(/^\/+|\/+$/g, "")

function decode(s: string): string {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** `#/a/b#c` → slug `a/b`, hash `c`. A bare `#name` (old-style link) is looked up as a slug. */
function readHashLocation(tree: DocsTree): { slug: string; hash: string } {
  const raw = window.location.hash.slice(1)
  if (!raw.startsWith("/")) {
    const loose = decode(raw)
    if (!loose) return { slug: "", hash: "" }
    const match = tree.bySlug.get(loose) ?? tree.pages.find((p) => p.slug.endsWith(`/${loose}`))
    return match ? { slug: match.slug, hash: "" } : { slug: "", hash: loose }
  }
  const at = raw.indexOf("#")
  return { slug: decode(trimSlashes(at >= 0 ? raw.slice(0, at) : raw)), hash: at >= 0 ? decode(raw.slice(at + 1)) : "" }
}

function readHistoryLocation(basePath: string): { slug: string; hash: string } {
  const base = trimSlashes(basePath)
  let path = trimSlashes(window.location.pathname)
  if (base && (path === base || path.startsWith(`${base}/`))) path = path.slice(base.length)
  return { slug: decode(trimSlashes(path)), hash: decode(window.location.hash.slice(1)) }
}

function useDocsRouter(tree: DocsTree, routing: DocsSiteRouting, basePath: string, initialPath: string | undefined) {
  const read = useCallback((): { slug: string; hash: string } => {
    if (routing === "memory" || typeof window === "undefined") {
      const [slug, hash = ""] = trimSlashes(initialPath ?? "").split("#")
      return { slug: slug ?? "", hash }
    }
    return routing === "history" ? readHistoryLocation(basePath) : readHashLocation(tree)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routing, basePath, tree])
  const [location, setLocation] = useState<Location>(() => ({ ...read(), key: 0 }))

  useEffect(() => {
    if (routing === "memory") return
    const sync = () => setLocation((l) => ({ ...read(), key: l.key + 1 }))
    window.addEventListener(routing === "history" ? "popstate" : "hashchange", sync)
    return () => window.removeEventListener(routing === "history" ? "popstate" : "hashchange", sync)
  }, [routing, read])

  const href = useCallback(
    (slug: string, hash = "") => {
      const h = hash ? `#${hash}` : ""
      if (routing === "history") {
        const base = trimSlashes(basePath)
        return `/${[base, slug].filter(Boolean).join("/")}${slug ? "" : base ? "/" : ""}${h}`
      }
      return `#/${slug}${h}`
    },
    [routing, basePath],
  )

  const navigate = useCallback(
    (slug: string, hash = "") => {
      if (routing === "hash") {
        const next = href(slug, hash)
        if (window.location.hash !== next) window.history.pushState(null, "", next)
      } else if (routing === "history") {
        window.history.pushState(null, "", href(slug, hash))
      }
      setLocation((l) => ({ slug, hash, key: l.key + 1 }))
    },
    [routing, href],
  )

  return { location, href, navigate }
}

const prefersDark = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-color-scheme: dark)").matches

function useSiteTheme(props: Pick<DocsSiteProps, "theme" | "defaultTheme" | "onThemeChange" | "themeStorageKey">, urlParam: boolean) {
  const storageKey = props.themeStorageKey === undefined ? "docstream-site-theme" : props.themeStorageKey
  const [choice, setChoice] = useState<DocsSiteTheme | "system">(() => {
    if (typeof window === "undefined") return props.defaultTheme ?? "system"
    if (urlParam) {
      const q = new URLSearchParams(window.location.search).get("theme")
      if (q === "light" || q === "dark") return q
    }
    if (storageKey) {
      try {
        const saved = window.localStorage.getItem(storageKey)
        if (saved === "light" || saved === "dark") return saved
      } catch {
        // storage blocked
      }
    }
    return props.defaultTheme ?? "system"
  })
  const [systemDark, setSystemDark] = useState(prefersDark)
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)")
    if (!mq) return
    const on = () => setSystemDark(mq.matches)
    mq.addEventListener?.("change", on)
    return () => mq.removeEventListener?.("change", on)
  }, [])
  const resolved: DocsSiteTheme = props.theme ?? (choice === "system" ? (systemDark ? "dark" : "light") : choice)
  const toggle = () => {
    const next: DocsSiteTheme = resolved === "dark" ? "light" : "dark"
    if (props.theme === undefined) setChoice(next)
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, next)
      } catch {
        // storage blocked
      }
    }
    props.onThemeChange?.(next)
  }
  return [resolved, toggle] as const
}

/** True for a plain left click that should navigate in place. */
const plainClick = (e: ReactMouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

function containsSlug(item: DocsNavItem, slug: string): boolean {
  if (item.kind === "page" && item.slug === slug) return true
  return item.kind !== "link" && item.children.some((c) => containsSlug(c, slug))
}

interface NavProps {
  items: DocsNavItem[]
  current: string
  href: (slug: string) => string
  go: (slug: string) => void
  depth?: number
}

function NavList({ items, current, href, go, depth = 0 }: NavProps) {
  return (
    <ul className="ds-site-nav-list" data-depth={depth}>
      {items.map((item, i) => (
        <NavEntry key={`${item.kind}:${item.title}:${i}`} item={item} current={current} href={href} go={go} depth={depth} />
      ))}
    </ul>
  )
}

function NavEntry({ item, current, href, go, depth = 0 }: Omit<NavProps, "items"> & { item: DocsNavItem }) {
  const active = containsSlug(item, current)
  const [open, setOpen] = useState(active)
  useEffect(() => {
    if (active) setOpen(true)
  }, [active])
  const childrenId = useId()

  if (item.kind === "group") {
    return (
      <li className="ds-site-nav-group">
        <div className="ds-site-nav-group-title">{item.title}</div>
        <NavList items={item.children} current={current} href={href} go={go} depth={depth} />
      </li>
    )
  }
  if (item.kind === "link") {
    return (
      <li>
        <a className="ds-site-nav-link" href={item.href} target="_blank" rel="noreferrer">
          {item.title}
          <span className="ds-site-nav-external" aria-hidden="true">↗</span>
        </a>
      </li>
    )
  }
  const hasChildren = item.children.length > 0
  const toggle = hasChildren ? (
    <button
      type="button"
      className="ds-site-nav-toggle"
      aria-expanded={open}
      aria-controls={childrenId}
      aria-label={`${open ? "Collapse" : "Expand"} ${item.title}`}
      onClick={(e) => {
        setOpen((o) => !o)
      }}
    >
      <ChevronRight size={14} aria-hidden="true" />
    </button>
  ) : null
  return (
    <li>
      {item.kind === "page" ? (
        <div className="ds-site-nav-row" data-current={item.slug === current || undefined}>
          <a
            className="ds-site-nav-link"
            href={href(item.slug)}
            aria-current={item.slug === current ? "page" : undefined}
            onClick={(e) => {
              if (!plainClick(e)) return
              e.preventDefault()
              go(item.slug)
              if (hasChildren) setOpen(true)
            }}
          >
            <span className="ds-site-nav-label">{item.title}</span>
          </a>
          {toggle}
        </div>
      ) : (
        <button type="button" className="ds-site-nav-link ds-site-nav-folder" aria-expanded={open} aria-controls={childrenId} onClick={() => setOpen((o) => !o)}>
          <span className="ds-site-nav-label">{item.title}</span>
          <span className="ds-site-nav-toggle" aria-hidden="true">
            <ChevronRight size={14} />
          </span>
        </button>
      )}
      {hasChildren && open ? (
        <div id={childrenId} className="ds-site-nav-children">
          <NavList items={item.children} current={current} href={href} go={go} depth={depth + 1} />
        </div>
      ) : null}
    </li>
  )
}

function SearchDialog({
  tree,
  onClose,
  onPick,
}: {
  tree: DocsTree
  onClose: () => void
  onPick: (r: DocsSearchResult) => void
}) {
  const index = useMemo(() => createDocsSearchIndex(tree), [tree])
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const results = useMemo(() => index.search(query, 30), [index, query])
  const inputRef = useRef<HTMLInputElement>(null)
  const listId = useId()
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => previous?.focus?.()
  }, [])
  useEffect(() => setActive(0), [query])
  useEffect(() => {
    document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: "nearest" })
  }, [active, listId])

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      onClose()
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      setActive((a) => Math.min(a + 1, results.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActive((a) => Math.max(a - 1, 0))
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault()
      onPick(results[active])
    }
  }

  const suggestions = query ? null : tree.order.slice(0, 8)
  return (
    <div className="ds-site-search-layer" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="ds-site-search" role="dialog" aria-modal="true" aria-label="Search documentation" onKeyDown={onKeyDown}>
        <div className="ds-site-search-field">
          <Search size={17} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            placeholder="Search the docs…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
            aria-autocomplete="list"
          />
          <kbd>esc</kbd>
        </div>
        {suggestions ? (
          <div className="ds-site-search-results" id={listId} role="listbox" aria-label="Pages">
            <div className="ds-site-search-caption">Pages</div>
            {suggestions.map((p) => (
              <button key={p.slug} type="button" className="ds-site-search-hit" role="option" aria-selected={false} onClick={() => onPick({ page: p, snippet: "", score: 0 })}>
                <FileText size={15} aria-hidden="true" />
                <span className="ds-site-search-hit-main">
                  <span className="ds-site-search-hit-title">{p.title}</span>
                  {p.breadcrumbs.length ? <span className="ds-site-search-hit-path">{p.breadcrumbs.join(" › ")}</span> : null}
                </span>
              </button>
            ))}
          </div>
        ) : results.length ? (
          <div className="ds-site-search-results" id={listId} role="listbox" aria-label="Results">
            {results.map((r, i) => (
              <button
                key={`${r.page.slug}#${r.anchor ?? ""}`}
                id={`${listId}-${i}`}
                type="button"
                className="ds-site-search-hit"
                role="option"
                aria-selected={i === active}
                onMouseMove={() => setActive(i)}
                onClick={() => onPick(r)}
              >
                {r.heading ? <Hash size={15} aria-hidden="true" /> : <FileText size={15} aria-hidden="true" />}
                <span className="ds-site-search-hit-main">
                  <span className="ds-site-search-hit-title">
                    {r.heading ? (
                      <>
                        {r.heading} <span className="ds-site-search-hit-page">· {r.page.title}</span>
                      </>
                    ) : (
                      r.page.title
                    )}
                  </span>
                  {r.snippet ? (
                    <span className="ds-site-search-hit-snippet">
                      {r.highlight ? (
                        <>
                          {r.snippet.slice(0, r.highlight[0])}
                          <mark>{r.snippet.slice(r.highlight[0], r.highlight[1])}</mark>
                          {r.snippet.slice(r.highlight[1])}
                        </>
                      ) : (
                        r.snippet
                      )}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="ds-site-search-empty">No results for “{query}”</div>
        )}
      </div>
    </div>
  )
}

function useActiveHeading(scroller: RefObject<HTMLElement | null>, outline: OutlineEntry[], pageKey: string) {
  const [active, setActive] = useState<string | undefined>(outline[0]?.id)
  useEffect(() => {
    const el = scroller.current
    if (!el || !outline.length) return
    let frame = 0
    const measure = () => {
      frame = 0
      const top = el.getBoundingClientRect().top
      let current = outline[0]?.id
      for (const entry of outline) {
        const h = el.querySelector<HTMLElement>(`[id="${CSS.escape(entry.id)}"]`)
        if (!h) continue
        if (h.getBoundingClientRect().top - top <= 96) current = entry.id
        else break
      }
      // At the very bottom the last heading may never reach the top; it is still the one being read.
      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 4) current = outline[outline.length - 1]?.id ?? current
      setActive(current)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    el.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      el.removeEventListener("scroll", onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [scroller, outline, pageKey])
  return active
}

const MIME: Record<string, string> = {
  json: "application/json",
  yaml: "application/yaml",
  yml: "application/yaml",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
  stl: "model/stl",
  rrweb: "application/json",
  txt: "text/plain",
  csv: "text/csv",
}

/**
 * Serves the tree's assets to the current page: a link resolved against the page's path that
 * names a file in the VFS loads as a `blob:` URL of it (made once per file and content, revoked
 * when the content changes or the site unmounts). Anything else goes to the host's resolver.
 */
function useVfsAssets(tree: DocsTree, page: DocsPage | undefined): AssetResolver | null {
  const outer = useContext(AssetResolverContext)
  const urls = useRef(new Map<string, { content: DocsFileContent; url: string }>())
  useEffect(() => {
    const map = urls.current
    return () => {
      for (const { url } of map.values()) URL.revokeObjectURL(url)
      map.clear()
    }
  }, [])
  return useMemo(() => {
    if (!page || !tree.assets.size || typeof URL.createObjectURL !== "function") return outer
    return (href: string) => {
      const asset = findLinkedAsset(tree, page, href)
      if (!asset) return outer ? outer(href) : undefined
      const cached = urls.current.get(asset.path)
      if (cached?.content === asset.content) return cached.url
      if (cached) URL.revokeObjectURL(cached.url)
      const ext = asset.path.slice(asset.path.lastIndexOf(".") + 1).toLowerCase()
      const blob = typeof asset.content === "string" ? new Blob([asset.content], { type: MIME[ext] ?? "text/plain" }) : asset.content
      const url = URL.createObjectURL(blob)
      urls.current.set(asset.path, { content: asset.content, url })
      return url
    }
  }, [tree, page, outer])
}

function cssLength(v: number | string | undefined, fallback: string) {
  return v === undefined ? fallback : typeof v === "number" ? `${v}px` : v
}

/** A complete docs site from Markdown files: sidebar from the file tree, search, outline, routing. */
export function DocsSite(props: DocsSiteProps) {
  const {
    files,
    treeOptions,
    title,
    logo,
    links = [],
    routing = "hash",
    basePath = "",
    initialPath,
    onNavigate,
    themeToggle = true,
    palette = true,
    accentColor,
    search = true,
    toc = true,
    pageActions = true,
    editUrl,
    sidebarFooter,
    footer,
    renderPage,
    notFound,
    height,
    liveRenderer,
    sourceRenderer,
    demoResolver,
    demoRuntime,
    demoDependencies,
    demoVFS,
    onTaskStateChange,
    documentProperties,
    className,
    style,
  } = props
  const tree = useMemo(() => props.tree ?? buildDocsTree(files ?? {}, treeOptions), [props.tree, files, treeOptions])
  const { location, href, navigate } = useDocsRouter(tree, routing, basePath, initialPath)
  const [theme, toggleTheme] = useSiteTheme(props, routing !== "memory")
  const applyThemeTo = props.applyThemeTo ?? (routing === "memory" ? "site" : "document")
  useEffect(() => {
    if (applyThemeTo === "document") document.documentElement.dataset.theme = theme
  }, [applyThemeTo, theme])

  const page = tree.bySlug.get(location.slug)
  const home = tree.bySlug.get("") ?? tree.order[0]
  // A site without a root README opens on its first page.
  const shown = page ?? (location.slug === "" ? home : undefined)

  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const go = useCallback(
    (slug: string, hash = "") => {
      navigate(slug, hash)
      setNavOpen(false)
    },
    [navigate],
  )

  // After a navigation: scroll to the anchor, else to the top, and tell the host.
  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    const target = location.hash ? el.querySelector<HTMLElement>(`[id="${CSS.escape(location.hash)}"]`) : null
    if (target) target.scrollIntoView?.({ block: "start" })
    else el.scrollTop = 0
    if (shown) onNavigate?.(shown, location.hash)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key, shown?.slug])

  const siteTitle = title
  useEffect(() => {
    const opt = props.documentTitle ?? routing !== "memory"
    if (!opt || !shown) return
    document.title =
      typeof opt === "function" ? opt(shown, siteTitle) : siteTitle && shown.title !== siteTitle ? `${shown.title} — ${siteTitle}` : shown.title
  }, [shown, siteTitle, props.documentTitle, routing])

  // Keyboard: ⌘K / Ctrl+K anywhere, "/" outside text fields.
  useEffect(() => {
    if (!search) return
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        // An embedded site only answers while it has focus, so a host page keeps its own ⌘K —
        // and a site leaves ⌘K to a site nested in it that has focus.
        const focusedSite = document.activeElement?.closest(".ds-site")
        if (routing === "memory" ? focusedSite !== rootRef.current : focusedSite && focusedSite !== rootRef.current) return
        e.preventDefault()
        setSearchOpen((o) => !o)
      } else if (e.key === "/" && !typing && routing !== "memory") {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [search, routing])

  const outline = useMemo(() => {
    if (!shown || !toc) return []
    return documentOutline(parseMarkdown(shown.body)).filter((e) => e.level === 2 || e.level === 3)
  }, [shown, toc])
  const activeHeading = useActiveHeading(scrollerRef, outline, shown?.slug ?? "")

  const resolveAsset = useVfsAssets(tree, shown)

  // Links written as relative `.md` paths (or `#anchors`) get real route hrefs, so they
  // navigate in place and still open in a new tab. Demos keep their own links.
  useEffect(() => {
    const article = articleRef.current
    if (!article || !shown) return
    const rewrite = () => {
      for (const a of article.querySelectorAll<HTMLAnchorElement>("a[href]")) {
        // Only this site's own demos: a site embedded in a demo still rewrites its links.
        const skip = a.closest(".docs-demo, .ds-site-pager, .ds-site-pagehead")
        if (skip && article.contains(skip)) continue
        if (a.dataset.dsHref !== undefined) continue
        const original = a.getAttribute("href") ?? ""
        const linked = findLinkedPage(tree, shown, original)
        if (!linked) {
          // A link to a file in the VFS (`[the spec](api.json)`) opens that file.
          if (resolveAsset && findLinkedAsset(tree, shown, original)) {
            const url = resolveAsset(original)
            if (typeof url === "string") {
              a.dataset.dsHref = original
              a.setAttribute("href", url)
              a.setAttribute("target", "_blank")
            }
          }
          continue
        }
        a.dataset.dsHref = original
        a.dataset.dsSlug = linked.page.slug
        a.dataset.dsHash = linked.hash
        a.setAttribute("href", href(linked.page.slug, linked.hash))
        a.removeAttribute("target")
      }
    }
    rewrite()
    // Lazy blocks (content refs inside tabs, expandables) mount later.
    const observer = new MutationObserver(rewrite)
    observer.observe(article, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [shown, tree, href, resolveAsset])

  const onArticleClick = (e: ReactMouseEvent) => {
    if (!plainClick(e) || e.defaultPrevented) return
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>("a[data-ds-slug]")
    // A link that belongs to a site nested in this one is that site's to follow.
    if (!a || a.target === "_blank" || a.closest(".ds-site-main") !== articleRef.current) return
    e.preventDefault()
    go(a.dataset.dsSlug ?? "", a.dataset.dsHash ?? "")
  }

  const index = shown ? tree.order.indexOf(shown) : -1
  const prev = index > 0 ? tree.order[index - 1] : undefined
  const next = index >= 0 ? tree.order[index + 1] : undefined

  const actions = shown ? (typeof pageActions === "function" ? pageActions(shown) : pageActions) : false
  const pageMarkdown = shown ? `# ${shown.title}\n\n${shown.description ? `${shown.description}\n\n` : ""}${shown.body}` : ""
  const pageUrl = shown && typeof window !== "undefined" && routing !== "memory" ? new URL(href(shown.slug), window.location.href).href : undefined

  const content = shown ? (
    <AssetResolverProvider resolve={resolveAsset}>
      <MarkdownContent
        key={shown.slug}
        markdown={shown.body}
        liveRenderer={liveRenderer}
        sourceRenderer={sourceRenderer}
        demoResolver={demoResolver}
        demoRuntime={demoRuntime}
        demoDependencies={demoDependencies}
        demoVFS={demoVFS}
        onTaskStateChange={onTaskStateChange}
        documentProperties={documentProperties}
      />
    </AssetResolverProvider>
  ) : null

  const rootStyle = {
    ...style,
    "--ds-site-height": cssLength(height, "100dvh"),
    ...(accentColor ? { "--primary": accentColor, "--ds-site-accent": accentColor } : {}),
  } as CSSProperties

  const brand = (
    <a
      className="ds-site-brand"
      href={href("")}
      onClick={(e) => {
        if (!plainClick(e)) return
        e.preventDefault()
        go("")
      }}
    >
      {logo ? <span className="ds-site-logo">{logo}</span> : null}
      {title ? <span className="ds-site-title">{title}</span> : null}
    </a>
  )
  const navTree = <NavList items={tree.nav} current={shown?.slug ?? location.slug} href={(s) => href(s)} go={(s) => go(s)} />

  return (
    <div
      ref={rootRef}
      className={["ds-site", className].filter(Boolean).join(" ")}
      data-theme={theme}
      data-palette={palette ? "" : undefined}
      data-nav-open={navOpen || undefined}
      style={rootStyle}
    >
      <header className="ds-site-header">
        <button type="button" className="ds-site-icon-btn ds-site-menu" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen(true)}>
          <Menu size={18} aria-hidden="true" />
        </button>
        {brand}
        <div className="ds-site-header-spacer" />
        {search ? (
          <button type="button" className="ds-site-search-btn" onClick={() => setSearchOpen(true)} aria-label="Search documentation" aria-keyshortcuts="Meta+K Control+K">
            <Search size={15} aria-hidden="true" />
            <span className="ds-site-search-btn-label">Search…</span>
            <kbd>⌘K</kbd>
          </button>
        ) : null}
        {links.length ? (
          <nav className="ds-site-links" aria-label="Site links">
            {links.map((l) => (
              <a key={l.href} href={l.href} target="_blank" rel="noreferrer" className="ds-site-header-link">
                {l.icon ?? null}
                <span>{l.label}</span>
              </a>
            ))}
          </nav>
        ) : null}
        {themeToggle ? (
          <button type="button" className="ds-site-icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
            {theme === "dark" ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
          </button>
        ) : null}
      </header>

      <div className="ds-site-body">
        <nav className="ds-site-sidebar" aria-label="Documentation">
          <div className="ds-site-sidebar-scroll">{navTree}</div>
          {sidebarFooter ? <div className="ds-site-sidebar-foot">{sidebarFooter}</div> : null}
        </nav>

        <div className="ds-site-scroll" ref={scrollerRef}>
          <div className="ds-site-columns">
            <main className="ds-site-main" ref={articleRef} onClick={onArticleClick}>
              {shown ? (
                <article className="ds-site-article">
                  <div className="ds-site-pagehead">
                    <div className="ds-site-pagehead-row">
                      {shown.breadcrumbs.length ? (
                        <nav className="ds-site-crumbs" aria-label="Breadcrumb">
                          {shown.breadcrumbs.map((c, i) => (
                            <span key={i}>
                              {i ? <ChevronRight size={12} aria-hidden="true" /> : null}
                              {c}
                            </span>
                          ))}
                        </nav>
                      ) : (
                        <span />
                      )}
                      {actions ? (
                        <DocPageActions
                          markdown={pageMarkdown}
                          resolver={demoResolver}
                          pageUrl={pageUrl}
                          {...(actions === true ? {} : actions)}
                        />
                      ) : null}
                    </div>
                    <h1 className="ds-site-page-title">{shown.title}</h1>
                    {shown.description ? <p className="ds-site-lede">{shown.description}</p> : null}
                  </div>
                  {renderPage ? renderPage(shown, content) : content}
                  <footer className="ds-site-pagefoot">
                    {editUrl?.(shown) ? (
                      <a className="ds-site-edit" href={editUrl(shown)} target="_blank" rel="noreferrer">
                        <PencilLine size={14} aria-hidden="true" />
                        Edit this page
                      </a>
                    ) : null}
                    <nav className="ds-site-pager" aria-label="Pagination">
                      {prev ? (
                        <a
                          className="ds-site-pager-link"
                          data-dir="prev"
                          href={href(prev.slug)}
                          onClick={(e) => {
                            if (!plainClick(e)) return
                            e.preventDefault()
                            go(prev.slug)
                          }}
                        >
                          <small>
                            <ArrowLeft size={12} aria-hidden="true" /> Previous
                          </small>
                          <strong>{prev.title}</strong>
                        </a>
                      ) : (
                        <span />
                      )}
                      {next ? (
                        <a
                          className="ds-site-pager-link"
                          data-dir="next"
                          href={href(next.slug)}
                          onClick={(e) => {
                            if (!plainClick(e)) return
                            e.preventDefault()
                            go(next.slug)
                          }}
                        >
                          <small>
                            Next <ArrowRight size={12} aria-hidden="true" />
                          </small>
                          <strong>{next.title}</strong>
                        </a>
                      ) : null}
                    </nav>
                    {footer ? <div className="ds-site-footer">{footer}</div> : null}
                  </footer>
                </article>
              ) : (
                <article className="ds-site-article ds-site-notfound">
                  {notFound ? (
                    notFound(location.slug)
                  ) : (
                    <>
                      <h1 className="ds-site-page-title">Page not found</h1>
                      <p className="ds-site-lede">
                        Nothing lives at <code>/{location.slug}</code>.{" "}
                        <a
                          href={href("")}
                          onClick={(e) => {
                            if (!plainClick(e)) return
                            e.preventDefault()
                            go("")
                          }}
                        >
                          Back to the start
                        </a>
                      </p>
                    </>
                  )}
                </article>
              )}
            </main>
            {toc && outline.length > 1 ? (
              <aside className="ds-site-toc" aria-label="On this page">
                <div className="ds-site-toc-title">On this page</div>
                <ul>
                  {outline.map((entry, i) => (
                    <li key={`${entry.id}-${i}`} data-level={entry.level}>
                      <a
                        href={href(shown!.slug, entry.id)}
                        aria-current={entry.id === activeHeading ? "location" : undefined}
                        onClick={(e) => {
                          if (!plainClick(e)) return
                          e.preventDefault()
                          go(shown!.slug, entry.id)
                        }}
                      >
                        {entry.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </aside>
            ) : null}
          </div>
        </div>
      </div>

      {navOpen ? (
        <div className="ds-site-drawer-layer" onMouseDown={(e) => e.target === e.currentTarget && setNavOpen(false)}>
          <nav
            className="ds-site-drawer"
            aria-label="Documentation"
            onKeyDown={(e) => {
              if (e.key === "Escape") setNavOpen(false)
            }}
          >
            <div className="ds-site-drawer-head">
              {brand}
              <button type="button" className="ds-site-icon-btn" aria-label="Close navigation" onClick={() => setNavOpen(false)} autoFocus>
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="ds-site-sidebar-scroll">{navTree}</div>
            {sidebarFooter ? <div className="ds-site-sidebar-foot">{sidebarFooter}</div> : null}
          </nav>
        </div>
      ) : null}

      {searchOpen ? (
        <SearchDialog
          tree={tree}
          onClose={() => setSearchOpen(false)}
          onPick={(r) => {
            setSearchOpen(false)
            go(r.page.slug, r.anchor ?? "")
          }}
        />
      ) : null}
    </div>
  )
}
