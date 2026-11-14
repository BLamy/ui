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
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react"
import { createDialogController, DialogTrigger } from "@ui-sdk/react/dialog"
import { createDrawerController, Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTrigger } from "@ui-sdk/react/drawer"
import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts"
import { ArrowLeft, ArrowRight, ChevronRight, Menu, Moon, PencilLine, Search, Sun, X } from "lucide-react"

import { AssetResolverContext, AssetResolverProvider, type AssetResolver } from "../asset-resolver"
import { envNamesFromProperties } from "../doc-env"
import { MarkdownContent, type DocRenderOptions, type LivePreviewRenderer, type SourceReferenceRenderer } from "../docs/DocsRenderer"
import { DocPageActions, type DocPageActionsOptions } from "../docs/PageActions"
import { documentOutline, type OutlineEntry } from "../gitbook/outline"
import { parseMarkdown } from "../gitbook/parse"
import { navNodes, navOpenFor } from "./nav"
import { SiteNav } from "./SiteNav"
import { SiteSearch } from "./SiteSearch"
import { buildDocsTree, findLinkedAsset, findLinkedPage, type BuildDocsTreeOptions, type DocsFileContent, type DocsFiles, type DocsNavItem, type DocsPage, type DocsTree } from "./tree"

export type DocsSiteRouting = "hash" | "history" | "memory"
export type DocsSiteTheme = "light" | "dark"

export interface DocsSiteLink {
  label: string
  href: string
  icon?: ReactNode
}

/** A section of the site in the header, like GitBook's spaces: the sidebar shows only its pages. */
export interface DocsSiteTab {
  title: string
  /** Slug prefix of its pages: `"blocks"` takes `blocks` and `blocks/…`. `""` takes every page no other tab claims. */
  path: string
  /** Where the tab goes. Default: the first of its pages in reading order. */
  slug?: string
}

const trimPath = (p: string) => p.replace(/^\/+|\/+$/g, "")

/** The tab a page belongs to: the longest `path` that prefixes its slug, else the catch-all (`""`) tab. */
export function tabForSlug(tabs: readonly DocsSiteTab[], slug: string): DocsSiteTab | undefined {
  let best: DocsSiteTab | undefined
  for (const t of tabs) {
    const p = trimPath(t.path)
    if (p && (slug === p || slug.startsWith(`${p}/`)) && (!best || p.length > trimPath(best.path).length)) best = t
  }
  return best ?? tabs.find((t) => !trimPath(t.path))
}

/** The sidebar items whose pages belong to `tab` (groups and folders keep only those; empty ones go). */
function navForTab(items: DocsNavItem[], tabs: readonly DocsSiteTab[], tab: DocsSiteTab): DocsNavItem[] {
  const out: DocsNavItem[] = []
  for (const item of items) {
    if (item.kind === "link") {
      if (tab === tabs.find((t) => !trimPath(t.path))) out.push(item)
      continue
    }
    const children = navForTab(item.children, tabs, tab)
    if (item.kind === "page") {
      if (tabForSlug(tabs, item.slug) === tab) out.push({ ...item, children })
      else out.push(...children)
    } else if (children.length) out.push({ ...item, children })
  }
  return out
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
  /**
   * Sections in the header (`[{ title: "Components", path: "" }, { title: "Blocks", path: "blocks" }]`): each owns the
   * pages under its `path`, the sidebar and Previous / Next stay inside the current one, and search covers them all.
   */
  tabs?: DocsSiteTab[]
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

/** ⌘K on Apple platforms, Ctrl+K elsewhere. */
const SEARCH_KEYS = "mod+k"

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

/** While `active`, writes the visible part of the site's box (in viewport px) to `--ds-site-frame-top`, `-left`,
 *  `-width` and `-height` on its root, where an embedded site's top-layer overlays (site.css) read it to cover the
 *  site and not the window. Follows the host page's scrolling and resizing. */
function useOverlayFrame(root: { current: HTMLElement | null }, active: boolean) {
  // Only ever active on the client, after a press: React 19 doesn't warn about a layout effect on the server.
  useLayoutEffect(() => {
    const el = root.current
    if (!active || !el) return
    const view = el.ownerDocument.defaultView ?? window
    const names = ["top", "left", "width", "height"].map((side) => `--ds-site-frame-${side}`)
    let frame = 0
    const measure = () => {
      frame = 0
      const box = el.getBoundingClientRect()
      const top = Math.max(0, box.top)
      const left = Math.max(0, box.left)
      const bottom = Math.min(view.innerHeight, box.bottom)
      const right = Math.min(view.innerWidth, box.right)
      const values = [top, left, Math.max(0, right - left), Math.max(0, bottom - top)]
      names.forEach((name, i) => el.style.setProperty(name, `${values[i]}px`))
    }
    const schedule = () => { if (!frame) frame = view.requestAnimationFrame(measure) }
    measure()
    view.addEventListener("scroll", schedule, { capture: true, passive: true })
    view.addEventListener("resize", schedule)
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule)
    observer?.observe(el)
    return () => {
      if (frame) view.cancelAnimationFrame(frame)
      view.removeEventListener("scroll", schedule, { capture: true })
      view.removeEventListener("resize", schedule)
      observer?.disconnect()
      names.forEach((name) => el.style.removeProperty(name))
    }
  }, [active])
}

/** A complete docs site from Markdown files: sidebar from the file tree, search, outline, routing. */
export function DocsSite(props: DocsSiteProps) {
  const {
    files,
    treeOptions,
    title,
    logo,
    links = [],
    tabs,
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
    tui,
    isStreaming,
    envHost,
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

  // The phone navigation (a drawer) and search (a dialog): their buttons sit in the header, far from their content.
  const [navDrawer] = useState(() => createDrawerController())
  const [searchDialog] = useState(() => createDialogController())
  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // A site embedded in another page (memory routing) keeps its overlays to itself: they trap focus but leave the host
  // page usable (no inert page, no scroll lock), and they cover only the site's box (useOverlayFrame).
  const embedded = routing === "memory"
  const overlayModal = embedded ? ("trap-focus" as const) : true
  const scrollerRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  useOverlayFrame(rootRef, embedded && (navOpen || searchOpen))

  const go = useCallback(
    (slug: string, hash = "") => {
      navigate(slug, hash)
      navDrawer.close()
    },
    [navigate, navDrawer],
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

  // ⌘K / Ctrl+K anywhere, "/" outside text fields. An embedded site only answers while it has focus, so a host
  // page keeps its own ⌘K, and a site leaves ⌘K to a site nested in it that has focus.
  const answers = () => {
    const focusedSite = document.activeElement?.closest(".ds-site")
    return routing === "memory" ? focusedSite === rootRef.current : !focusedSite || focusedSite === rootRef.current
  }
  useShortcut(search ? SEARCH_KEYS : null, () => void searchDialog.open(), { when: answers, description: "Search documentation" })
  useShortcut(search && routing !== "memory" ? "/" : null, () => void searchDialog.open(), { when: answers, description: "Search documentation" })
  const searchHint = useShortcutHint(SEARCH_KEYS)

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

  const currentSlug = shown?.slug ?? location.slug
  const activeTab = tabs?.length ? tabForSlug(tabs, currentSlug) : undefined
  // The sidebar's sections: the ones around the page being read open with it, and stay as the reader left them.
  const nav = useMemo(() => navNodes(activeTab ? navForTab(tree.nav, tabs!, activeTab) : tree.nav), [tree, tabs, activeTab])
  const [expanded, setExpanded] = useState(() => navOpenFor(nav, currentSlug))
  useEffect(() => {
    const open = navOpenFor(nav, currentSlug)
    setExpanded((prev) => (open.every((value) => prev.includes(value)) ? prev : [...new Set([...prev, ...open])]))
  }, [nav, currentSlug])
  const pageHref = useCallback((slug: string) => href(slug), [href])
  const order = activeTab ? tree.order.filter((p) => tabForSlug(tabs!, p.slug) === activeTab) : tree.order
  const index = shown ? order.indexOf(shown) : -1
  const prev = index > 0 ? order[index - 1] : undefined
  const next = index >= 0 ? order[index + 1] : undefined

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
        tui={tui}
        isStreaming={isStreaming}
        envHost={envHost}
        env={envNamesFromProperties(shown.frontmatter)}
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
  const navTree = <SiteNav nodes={nav} current={currentSlug} expanded={expanded} onExpandedChange={setExpanded} href={pageHref} go={go} />
  const tabTarget = (t: DocsSiteTab) => t.slug ?? tree.order.find((p) => tabForSlug(tabs!, p.slug) === t)?.slug ?? trimPath(t.path)
  const tabBar = (where: "header" | "drawer") => tabs?.length ? (
    <nav className={`ds-site-tabs ds-site-tabs-${where}`} aria-label="Sections">
      {tabs.map((t) => (
        <a
          key={t.title}
          className="ds-site-tab"
          href={href(tabTarget(t))}
          aria-current={t === activeTab ? "page" : undefined}
          onClick={(e) => {
            if (!plainClick(e)) return
            e.preventDefault()
            go(tabTarget(t))
          }}
        >
          {t.title}
        </a>
      ))}
    </nav>
  ) : null

  return (
    <div
      ref={rootRef}
      className={["ds-site", className].filter(Boolean).join(" ")}
      data-theme={theme}
      data-palette={palette ? "" : undefined}
      data-nav-open={navOpen || undefined}
      data-embedded={embedded ? "" : undefined}
      style={rootStyle}
    >
      <header className="ds-site-header">
        <DrawerTrigger controller={navDrawer} className="ds-site-icon-btn ds-site-menu" aria-label="Open navigation">
          <Menu size={18} aria-hidden="true" />
        </DrawerTrigger>
        {brand}
        {tabBar("header")}
        <div className="ds-site-header-spacer" />
        {search ? (
          <DialogTrigger controller={searchDialog} className="ds-site-search-btn" aria-label="Search documentation" aria-keyshortcuts={searchHint.ariaKeyshortcuts}>
            <Search size={15} aria-hidden="true" />
            <span className="ds-site-search-btn-label">Search…</span>
            <kbd>{searchHint.text}</kbd>
          </DialogTrigger>
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
          {/* Frontmatter `layout: wide` widens the column (galleries, full-width demos) and drops the outline. */}
          <div className="ds-site-columns" data-layout={shown?.frontmatter.layout === "wide" ? "wide" : undefined}>
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

      <Drawer controller={navDrawer} side="left" modal={overlayModal} onOpenChange={setNavOpen}>
        <DrawerBackdrop className="ds-site-drawer-layer" />
        <DrawerContent className="ds-site-drawer" aria-label="Navigation" initialFocus='[data-slot="drawer-close"]'>
          <div className="ds-site-drawer-head">
            {brand}
            <DrawerClose className="ds-site-icon-btn" aria-label="Close navigation">
              <X size={18} aria-hidden="true" />
            </DrawerClose>
          </div>
          {tabBar("drawer")}
          <nav className="ds-site-sidebar-scroll" aria-label="Documentation">{navTree}</nav>
          {sidebarFooter ? <div className="ds-site-sidebar-foot">{sidebarFooter}</div> : null}
        </DrawerContent>
      </Drawer>

      {search ? (
        <SiteSearch
          tree={tree}
          controller={searchDialog}
          modal={overlayModal}
          onOpenChange={setSearchOpen}
          shortcut={SEARCH_KEYS}
          href={href}
          onPick={(r) => {
            searchDialog.close()
            go(r.page.slug, r.anchor ?? "")
          }}
        />
      ) : null}
    </div>
  )
}
