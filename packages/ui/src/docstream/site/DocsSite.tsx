/* DocsSite — a GitBook-style documentation site from a folder of Markdown files.

   Hand it every file you have (`import.meta.glob("./docs/**", { query: "?raw", eager: true })`,
   a fetched repo tree, an in-memory VFS); it keeps the Markdown, builds the sidebar from the
   folders (or SUMMARY.md), and renders each page through docstream with a header, search
   (⌘K), an "On this page" outline, breadcrumbs, previous / next and "Copy page".
   Relative `.md` links between pages navigate in place. Routing is the URL hash by default
   (static hosting needs no rewrites), the History API with `routing="history"`, or in-memory
   with `routing="memory"` for a site embedded in another page.

   Under a host page's own bar, `header={false}` leaves the site's header out, and a controller
   (`createDocsSiteController()`) lets that bar hold the two controls only the header had:
   `DocsSiteSearchTrigger` and `DocsSiteNavigationTrigger`. */
import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type RefObject,
} from "react"
import { createDialogController, DialogTrigger } from "@ui-sdk/react/dialog"
import { createDrawerController, Drawer, DrawerBackdrop, DrawerClose, DrawerContent, DrawerTrigger } from "@ui-sdk/react/drawer"
import { useShortcut, useShortcutHint } from "@ui-sdk/react/shortcuts"
import { Glyph } from "../ui/glyph"

import { AssetResolverContext, AssetResolverProvider, type AssetResolver } from "../asset-resolver"
import { envNamesFromProperties } from "../doc-env"
import { MarkdownContent, type DocRenderOptions, type LivePreviewRenderer, type SourceReferenceRenderer } from "../docs/DocsRenderer"
import { DocPageActions, type DocPageActionsOptions } from "../docs/PageActions"
import { documentOutline, type OutlineEntry } from "../gitbook/outline"
import { parseMarkdown } from "../gitbook/parse"
import { navCurrent, navNodes, navOpenFor } from "./nav"
import { SiteNav } from "./SiteNav"
import { SiteSearch } from "./SiteSearch"
import { buildDocsTree, findLinkedAsset, findLinkedPage, readFrontmatter, type BuildDocsTreeOptions, type DocsFileContent, type DocsFiles, type DocsNavItem, type DocsPage, type DocsTree } from "./tree"

export type DocsSiteRouting = "hash" | "history" | "memory"
export type DocsSiteAppearance = "light" | "dark"

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
  /** Where the site's routes start: the path prefix for `routing="history"` (`"/docs"` → `/docs/guides/install`),
   *  or the hash prefix for `routing="hash"` (`"docs"` → `#/docs/guides/install`), so one app can host several sites. */
  basePath?: string
  /** First page for `routing="memory"` (a slug, e.g. `"guides/install"`). */
  defaultPath?: string
  /** Called after every navigation. */
  onNavigate?: (page: DocsPage, hash: string) => void
  /** Light or dark, controlled. Pair it with `onAppearanceChange`. */
  appearance?: DocsSiteAppearance
  /** The starting appearance when uncontrolled: `"auto"` (the default) follows the system setting until the reader
   *  picks one. */
  defaultAppearance?: DocsSiteAppearance | "auto"
  /** Runs when the reader switches between light and dark. */
  onAppearanceChange?: (appearance: DocsSiteAppearance) => void
  /** Show the light / dark switch (default true). */
  appearanceToggle?: boolean
  /** localStorage key for the reader's choice; `false` to not persist (default `"docstream-site-theme"`). */
  appearanceStorageKey?: string | false
  /** Where `data-theme` goes: the whole document (default, unless memory routing) or just the site. */
  applyAppearanceTo?: "document" | "site"
  /** Use docstream's built-in light / dark colors (default true). Turn off when your app defines shadcn-style tokens. */
  palette?: boolean
  /** Brand color (a CSS color) for links, current items and focus rings. */
  tint?: string
  /** The site's own header: brand, tabs, search button, links, appearance switch and, on a narrow site, the button
   *  that opens the navigation drawer (default true). `false` under a host page's own bar, so there is one bar: the
   *  site then starts at its sidebar and page, ⌘K still searches, `title` still names the browser tab, and `tabs`
   *  still scope the sidebar and show in the drawer. Put `DocsSiteSearchTrigger` and `DocsSiteNavigationTrigger` in
   *  the host's bar (they need `controller`), and anything from `links` the host doesn't already offer. */
  header?: boolean
  /** Connects the site to `DocsSiteSearchTrigger` and `DocsSiteNavigationTrigger` written outside it. Make it once
   *  with `createDocsSiteController()` and give the same one to the site and to each trigger. */
  controller?: DocsSiteController
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

/** Strips `basePath` from the front of a route path (`docs/guides` → `guides`). */
function underBase(path: string, basePath: string): string {
  const base = trimSlashes(basePath)
  return base && (path === base || path.startsWith(`${base}/`)) ? trimSlashes(path.slice(base.length)) : path
}

/** `#/a/b#c` → slug `a/b`, hash `c` (after `basePath`). A bare `#name` (old-style link) is looked up as a slug. */
function readHashLocation(tree: DocsTree, basePath: string): { slug: string; hash: string } {
  const raw = window.location.hash.slice(1)
  if (!raw.startsWith("/")) {
    const loose = decode(raw)
    if (!loose) return { slug: "", hash: "" }
    const match = tree.bySlug.get(loose) ?? tree.pages.find((p) => p.slug.endsWith(`/${loose}`))
    return match ? { slug: match.slug, hash: "" } : { slug: "", hash: loose }
  }
  const at = raw.indexOf("#")
  const path = trimSlashes(at >= 0 ? raw.slice(0, at) : raw)
  return { slug: decode(underBase(path, basePath)), hash: at >= 0 ? decode(raw.slice(at + 1)) : "" }
}

function readHistoryLocation(basePath: string): { slug: string; hash: string } {
  return { slug: decode(underBase(trimSlashes(window.location.pathname), basePath)), hash: decode(window.location.hash.slice(1)) }
}

function useDocsRouter(tree: DocsTree, routing: DocsSiteRouting, basePath: string, defaultPath: string | undefined) {
  const read = useCallback((): { slug: string; hash: string } => {
    if (routing === "memory" || typeof window === "undefined") {
      const [slug, hash = ""] = trimSlashes(defaultPath ?? "").split("#")
      return { slug: slug ?? "", hash }
    }
    return routing === "history" ? readHistoryLocation(basePath) : readHashLocation(tree, basePath)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `defaultPath` is where memory routing starts, read once; changing it later does not navigate.
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
      const base = trimSlashes(basePath)
      if (routing === "history") return `/${[base, slug].filter(Boolean).join("/")}${slug ? "" : base ? "/" : ""}${h}`
      return `#/${[base, slug].filter(Boolean).join("/")}${h}`
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

function useSiteAppearance(props: Pick<DocsSiteProps, "appearance" | "defaultAppearance" | "onAppearanceChange" | "appearanceStorageKey">, urlParam: boolean) {
  const storageKey = props.appearanceStorageKey === undefined ? "docstream-site-theme" : props.appearanceStorageKey
  const [choice, setChoice] = useState<DocsSiteAppearance | "auto">(() => {
    if (typeof window === "undefined") return props.defaultAppearance ?? "auto"
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
    return props.defaultAppearance ?? "auto"
  })
  const [systemDark, setSystemDark] = useState(prefersDark)
  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)")
    if (!mq) return
    const on = () => setSystemDark(mq.matches)
    mq.addEventListener?.("change", on)
    return () => mq.removeEventListener?.("change", on)
  }, [])
  const resolved: DocsSiteAppearance = props.appearance ?? (choice === "auto" ? (systemDark ? "dark" : "light") : choice)
  const toggle = () => {
    const next: DocsSiteAppearance = resolved === "dark" ? "light" : "dark"
    if (props.appearance === undefined) setChoice(next)
    if (storageKey) {
      try {
        window.localStorage.setItem(storageKey, next)
      } catch {
        // storage blocked
      }
    }
    props.onAppearanceChange?.(next)
  }
  return [resolved, toggle] as const
}

/** True for a plain left click that should navigate in place. */
const plainClick = (e: ReactMouseEvent) => e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey

/** ⌘K on Apple platforms, Ctrl+K elsewhere. */
const SEARCH_KEYS = "mod+k"

/**
 * Connects a DocsSite to the parts written outside it (`DocsSiteSearchTrigger`, `DocsSiteNavigationTrigger`), the way
 * UI SDK's dialog controller connects a trigger to a dialog elsewhere on the page. Make one with
 * `createDocsSiteController()`, keep it for the life of the page, and give it to `<DocsSite controller>` and to each
 * part. One controller serves one mounted site at a time (a router that swaps sites can share it between them).
 */
export interface DocsSiteController {
  /** Opens the site's search, as ⌘K does. Nothing happens while no site with `search` uses the controller. */
  openSearch: () => void
  /** Opens the site's navigation drawer. Nothing happens while no site uses the controller. */
  openNavigation: () => void
}

/** What the site and its parts share through a controller. */
interface SiteConnection {
  /** The search dialog's and the navigation drawer's own controllers: the triggers are theirs. */
  search: ReturnType<typeof createDialogController<unknown, string>>
  navigation: ReturnType<typeof createDrawerController<unknown, string>>
  /** Whether the mounted site's sidebar is folded into the drawer (its narrow layout). */
  sidebarCollapsed: () => boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  subscribe: (listener: () => void) => () => void
}

/* The connection rides on the controller itself, under a registered symbol, so a controller still works for a second
   copy of this module: one made before a hot update of this file, or by another build of the package on the page. */
const CONNECTION = Symbol.for("docstream.site.connection")

function connectionOf(controller: DocsSiteController): SiteConnection {
  const connection = (controller as { [CONNECTION]?: SiteConnection })[CONNECTION]
  if (!connection) throw new Error("DocsSite: `controller` must be made with createDocsSiteController().")
  return connection
}

/** A controller for one DocsSite and the triggers written outside it. Create it once (`useState(createDocsSiteController)`
 *  or at module scope), not on every render. */
export function createDocsSiteController(): DocsSiteController {
  const search = createDialogController()
  const navigation = createDrawerController()
  const listeners = new Set<() => void>()
  let collapsed = false
  const connection: SiteConnection = {
    search,
    navigation,
    sidebarCollapsed: () => collapsed,
    setSidebarCollapsed: (next) => {
      if (next === collapsed) return
      collapsed = next
      for (const listener of listeners) listener()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
  }
  const controller: DocsSiteController = {
    openSearch: () => void search.open(),
    openNavigation: () => void navigation.open(),
  }
  return Object.defineProperty(controller, CONNECTION, { value: connection })
}

export type DocsSiteSearchTriggerProps = Omit<ComponentProps<typeof DialogTrigger>, "controller"> & {
  /** The controller given to `<DocsSite controller>`. */
  controller: DocsSiteController
}

/**
 * The button that opens a site's search, wherever it is written: the site's own header draws this one, and with
 * `header={false}` the host's bar holds it. It is the search dialog's trigger (UI SDK's DialogTrigger: `render` for
 * your own button, `className`, `aria-expanded`, focus back to it when the dialog closes), named "Search
 * documentation" and announcing the shortcut. Its default content is a magnifier, "Search…" and the shortcut in a
 * `<kbd>`; children replace it. Until its site mounts it is a plain button, so write it only beside a site that has
 * `search`.
 */
export function DocsSiteSearchTrigger({ controller, children, ...props }: DocsSiteSearchTriggerProps) {
  const hint = useShortcutHint(SEARCH_KEYS)
  return (
    <DialogTrigger controller={connectionOf(controller).search} aria-label="Search documentation" aria-keyshortcuts={hint.ariaKeyshortcuts} {...props}>
      {children ?? (
        <>
          <Glyph name="magnifyingglass" size={15} />
          <span className="ds-site-search-btn-label">Search…</span>
          <kbd>{hint.text}</kbd>
        </>
      )}
    </DialogTrigger>
  )
}

export type DocsSiteNavigationTriggerProps = Omit<ComponentProps<typeof DrawerTrigger>, "controller"> & {
  /** The controller given to `<DocsSite controller>`. */
  controller: DocsSiteController
}

/** The navigation drawer's trigger, always rendered: the site's own header hides it with a container query. */
function NavigationTrigger({ controller, children, ...props }: DocsSiteNavigationTriggerProps) {
  return (
    <DrawerTrigger controller={connectionOf(controller).navigation} aria-label="Open navigation" {...props}>
      {children ?? <Glyph name="menu" size={18} />}
    </DrawerTrigger>
  )
}

/**
 * The button that opens a site's navigation drawer, for a host's bar over a site with `header={false}`. It renders
 * only while the site's sidebar is folded into the drawer (the site is narrow), so it can be written unconditionally:
 * on a wide site, and while no site is mounted, it renders nothing. It is the drawer's trigger (UI SDK's
 * DrawerTrigger: `render`, `className`, focus back to it when the drawer closes), named "Open navigation"; its default
 * content is a menu glyph, and children replace it.
 */
export function DocsSiteNavigationTrigger(props: DocsSiteNavigationTriggerProps) {
  const connection = connectionOf(props.controller)
  const collapsed = useSyncExternalStore(connection.subscribe, connection.sidebarCollapsed, () => false)
  return collapsed ? <NavigationTrigger {...props} /> : null
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
  replay: "application/json",
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
/** A page as Copy page gives it: Markdown that renders as the page anywhere. The site draws the title and lede itself,
    so they come back as `# title` and a paragraph; of the site's frontmatter, `env` means something to any renderer
    (the variables the page's demos read), so it stays, as frontmatter; the rest (`order`, `icon`, `layout`…) is the
    site's own. */
export function pageCopyMarkdown(page: Pick<DocsPage, "title" | "description" | "body" | "frontmatter">): string {
  // A page whose frontmatter isn't only the site's keeps all of it in its body already.
  const env = readFrontmatter(page.body).length ? [] : envNamesFromProperties(page.frontmatter)
  const frontmatter = env.length ? `---\nenv: [${env.join(", ")}]\n---\n\n` : ""
  return `${frontmatter}# ${page.title}\n\n${page.description ? `${page.description}\n\n` : ""}${page.body}`
}

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
    defaultPath,
    onNavigate,
    appearanceToggle = true,
    palette = true,
    tint,
    header = true,
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
    streaming,
    envHost,
    className,
    style,
  } = props
  const tree = useMemo(() => props.tree ?? buildDocsTree(files ?? {}, treeOptions), [props.tree, files, treeOptions])
  const { location, href, navigate } = useDocsRouter(tree, routing, basePath, defaultPath)
  const [theme, toggleTheme] = useSiteAppearance(props, routing !== "memory")
  const applyThemeTo = props.applyAppearanceTo ?? (routing === "memory" ? "site" : "document")
  useEffect(() => {
    if (applyThemeTo === "document") document.documentElement.dataset.theme = theme
  }, [applyThemeTo, theme])

  const page = tree.bySlug.get(location.slug)
  const home = tree.bySlug.get("") ?? tree.order[0]
  // A site without a root README opens on its first page.
  const shown = page ?? (location.slug === "" ? home : undefined)

  // The phone navigation (a drawer) and search (a dialog): their buttons sit in the header, far from their content,
  // or in the host's bar when it brings the controller.
  const [ownController] = useState(createDocsSiteController)
  const controller = props.controller ?? ownController
  const connection = connectionOf(controller)
  const { navigation: navDrawer, search: searchDialog } = connection
  const [navOpen, setNavOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  // A site embedded in another page (memory routing) keeps its overlays to itself: they trap focus but leave the host
  // page usable (no inert page, no scroll lock), and they cover only the site's box (useOverlayFrame).
  const embedded = routing === "memory"
  const overlayModal = embedded ? ("trap-focus" as const) : true
  const scrollerRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  useOverlayFrame(rootRef, embedded && (navOpen || searchOpen))

  // A trigger outside the site can't read the site's container queries, so the site tells its controller when the
  // stylesheet has folded the sidebar into the drawer. Only a host's controller has parts out there to tell.
  const shared = props.controller ? connection : undefined
  useLayoutEffect(() => {
    const root = rootRef.current
    const sidebar = sidebarRef.current
    if (!shared || !root || !sidebar) return
    const view = root.ownerDocument.defaultView ?? window
    const measure = () => shared.setSidebarCollapsed(view.getComputedStyle(sidebar).display === "none")
    measure()
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(measure)
    observer?.observe(root)
    return () => {
      observer?.disconnect()
      shared.setSidebarCollapsed(false)
    }
  }, [shared])

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per navigation (`location.key`) or page change, not when the callback or the hash object is remade.
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
  // The first render (and the server's HTML) starts with them open. After that the Tree's `current` expands the
  // page's ancestors itself; what's left here is opening the page's own section when it has pages under it.
  const [expanded, setExpanded] = useState(() => navOpenFor(nav, currentSlug))
  useEffect(() => {
    const own = navCurrent(nav, currentSlug)
    if (!own || navOpenFor(nav, currentSlug).at(-1) !== own) return
    setExpanded((prev) => (prev.includes(own) ? prev : [...prev, own]))
  }, [nav, currentSlug])
  const pageHref = useCallback((slug: string) => href(slug), [href])
  const order = activeTab ? tree.order.filter((p) => tabForSlug(tabs!, p.slug) === activeTab) : tree.order
  const index = shown ? order.indexOf(shown) : -1
  const prev = index > 0 ? order[index - 1] : undefined
  const next = index >= 0 ? order[index + 1] : undefined

  const actions = shown ? (typeof pageActions === "function" ? pageActions(shown) : pageActions) : false
  const pageMarkdown = shown ? pageCopyMarkdown(shown) : ""
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
        streaming={streaming}
        envHost={envHost}
        env={envNamesFromProperties(shown.frontmatter)}
      />
    </AssetResolverProvider>
  ) : null

  const rootStyle = {
    ...style,
    "--ds-site-height": cssLength(height, "100dvh"),
    ...(tint ? { "--primary": tint, "--ds-site-accent": tint } : {}),
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
      data-headerless={header ? undefined : ""}
      style={rootStyle}
    >
      {header ? (
        <header className="ds-site-header">
          <NavigationTrigger controller={controller} className="ds-site-icon-btn ds-site-menu" />
          {brand}
          {tabBar("header")}
          <div className="ds-site-header-spacer" />
          {search ? <DocsSiteSearchTrigger controller={controller} className="ds-site-search-btn" /> : null}
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
          {appearanceToggle ? (
            <button type="button" className="ds-site-icon-btn" onClick={toggleTheme} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}>
              {theme === "dark" ? <Glyph name="sun" size={16} /> : <Glyph name="moon" size={16} />}
            </button>
          ) : null}
        </header>
      ) : null}

      <div className="ds-site-body">
        <nav className="ds-site-sidebar" ref={sidebarRef} aria-label="Documentation">
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
                              {i ? <Glyph name="chevron-right" size={12} /> : null}
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
                        <Glyph name="pencil" size={14} />
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
                            <Glyph name="arrow-left" size={12} /> Previous
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
                            Next <Glyph name="arrow-right" size={12} />
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
              <Glyph name="xmark" size={18} />
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
