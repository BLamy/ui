/* The Code view's path header: a VS Code style breadcrumb for the active file.

   One button per path part (the demo `src` first, then the folders, then the file), with a chevron
   between them. A folder button opens a menu of that folder's siblings (everything in its parent
   folder, the current one marked); the file button lists the files beside it. Picking a file selects
   it, picking a folder opens the first file inside it. When the segments don't fit the container the
   middle collapses into a single `…` that lists the hidden segments.

   Plain accessible DOM (nav > ol, buttons, role="menu"), so docstream needs nothing beyond React.
   The menu is portalled and `position: fixed`, so the viewer's overflow never clips it. The segment,
   sibling and fit maths are pure and exported (see PathBreadcrumb.test.ts). */
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { createPortal } from "react-dom"
import { Check, ChevronRight, FileCode2, Folder } from "lucide-react"

export interface CrumbSegment {
  /** Unique within the breadcrumb. */
  key: string
  name: string
  /** `src`: a part of the demo id (it names the demo's root); `dir`/`file`: a part of the file path. */
  kind: "src" | "dir" | "file"
  /** The folder or file path within the demo's file list. Empty for `src` segments. */
  path: string
}

export interface CrumbEntry {
  kind: "dir" | "file"
  name: string
  /** The entry's path within the demo's file list (empty for a demo root). */
  path: string
  /** The file to open when the entry is picked: itself for a file, the first file inside for a folder. */
  target: string
}

/** The hidden stretch of a collapsed breadcrumb: segments `start` up to (not including) `end`. */
export interface CrumbRange {
  start: number
  end: number
}

/** `src` parts, then the folders, then the file. */
export function buildCrumbs(src: string, filePath: string): CrumbSegment[] {
  const out: CrumbSegment[] = []
  for (const name of src.split("/").filter(Boolean)) out.push({ key: `s${out.length}:${name}`, name, kind: "src", path: "" })
  const parts = filePath.split("/").filter(Boolean)
  parts.forEach((name, index) => {
    const path = parts.slice(0, index + 1).join("/")
    out.push({ key: `p:${path}`, name, kind: index === parts.length - 1 ? "file" : "dir", path })
  })
  return out
}

const parentOf = (path: string) => path.slice(0, Math.max(0, path.lastIndexOf("/")))

/** The first file (in list order) at or below `folder`; `""` is the demo root. */
export function firstFileIn(paths: readonly string[], folder: string): string | undefined {
  return folder === "" ? paths[0] : paths.find((p) => p.startsWith(`${folder}/`))
}

/** The direct children of `folder` (`""` is the root): folders first, then files, each A to Z. */
export function childEntries(paths: readonly string[], folder: string): CrumbEntry[] {
  const prefix = folder === "" ? "" : `${folder}/`
  const dirs = new Map<string, CrumbEntry>()
  const files: CrumbEntry[] = []
  for (const path of paths) {
    if (!path.startsWith(prefix)) continue
    const rest = path.slice(prefix.length)
    const slash = rest.indexOf("/")
    if (slash < 0) files.push({ kind: "file", name: rest, path, target: path })
    else {
      const name = rest.slice(0, slash)
      if (!dirs.has(name)) dirs.set(name, { kind: "dir", name, path: prefix + name, target: path })
    }
  }
  const byName = (a: CrumbEntry, b: CrumbEntry) => a.name.localeCompare(b.name, undefined, { numeric: true })
  return [...[...dirs.values()].sort(byName), ...files.sort(byName)]
}

/** The menu a segment opens: the entries beside it. A `src` segment is the demo root, so it lists the
 *  root; the file segment lists only the files in its folder. */
export function siblingEntries(paths: readonly string[], segment: CrumbSegment): CrumbEntry[] {
  if (segment.kind === "src") return childEntries(paths, "")
  const entries = childEntries(paths, parentOf(segment.path))
  return segment.kind === "file" ? entries.filter((e) => e.kind === "file") : entries
}

/** The menu behind `…`: the hidden segments, each opening like a folder picked in a sibling menu. */
export function hiddenEntries(paths: readonly string[], segments: readonly CrumbSegment[], range: CrumbRange): CrumbEntry[] {
  return segments.slice(range.start, range.end).flatMap((segment) => {
    const target = firstFileIn(paths, segment.path)
    return target === undefined ? [] : [{ kind: segment.kind === "file" ? ("file" as const) : ("dir" as const), name: segment.name, path: segment.path, target }]
  })
}

/** Whether the active file is this entry, or inside this folder. */
export function entryContains(entry: Pick<CrumbEntry, "path">, active: string): boolean {
  return entry.path !== "" && (active === entry.path || active.startsWith(`${entry.path}/`))
}

/**
 * Which middle segments to hide so the breadcrumb fits `available` px. `widths` are the full item
 * widths (each includes its own chevron), `ellipsisWidth` the width of the `…` item. The first and
 * last segments always stay; as many trailing segments as fit are kept; null when everything fits
 * (or there is nothing to hide). With no room at all you still get first, `…`, last.
 */
export function collapseRange(widths: readonly number[], ellipsisWidth: number, available: number): CrumbRange | null {
  const n = widths.length
  if (n < 3) return null
  if (widths.reduce((sum, w) => sum + w, 0) <= available) return null
  let tail = 0
  for (let end = n - 1; end >= 2; end--) {
    tail += widths[end]
    if (widths[0] + ellipsisWidth + tail > available) return { start: 1, end: Math.min(n - 1, end + 1) }
  }
  return { start: 1, end: 2 }
}

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect

interface OpenMenu {
  id: string
  anchor: HTMLElement
  label: string
  entries: CrumbEntry[]
}

export interface PathBreadcrumbProps {
  /** The demo id, shown as the leading segments. */
  src: string
  /** The active file's path. */
  path: string
  /** Every file path in the demo. */
  paths: readonly string[]
  onSelect: (path: string) => void
  className?: string
}

export function PathBreadcrumb({ src, path, paths, onSelect, className }: PathBreadcrumbProps) {
  const segments = buildCrumbs(src, path)
  const nav = useRef<HTMLElement | null>(null)
  const measure = useRef<HTMLOListElement | null>(null)
  const [range, setRange] = useState<CrumbRange | null>(null)
  const [menu, setMenu] = useState<OpenMenu | null>(null)
  const menuId = useId()
  const signature = segments.map((s) => s.name).join("/")

  const fit = useCallback(() => {
    const el = nav.current
    const items = measure.current ? Array.from(measure.current.children) : []
    if (!el || items.length < 2) return
    const available = el.clientWidth
    if (!available) return // hidden (display: none) or not laid out: keep what we have
    const widths = items.map((item) => item.getBoundingClientRect().width)
    const ellipsis = widths.pop() as number
    const next = collapseRange(widths, ellipsis, available)
    setRange((prev) => (prev?.start === next?.start && prev?.end === next?.end ? prev : next))
  }, [])

  useIsoLayoutEffect(fit, [fit, signature])
  useEffect(() => {
    const el = nav.current
    if (!el || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    if (measure.current) observer.observe(measure.current)
    return () => observer.disconnect()
  }, [fit])

  const close = useCallback((refocus: boolean) => {
    setMenu((current) => {
      if (current && refocus && current.anchor.isConnected) current.anchor.focus()
      return null
    })
  }, [])

  const choose = (entry: CrumbEntry) => {
    setMenu(null)
    onSelect(entry.target)
    // The segments are re-keyed for the new file; park focus on its last segment.
    requestAnimationFrame(() => nav.current?.querySelector<HTMLElement>("[data-crumb-last]")?.focus())
  }

  const open = (id: string, anchor: HTMLElement, label: string, entries: CrumbEntry[]) =>
    setMenu((current) => (current?.id === id ? null : { id, anchor, label, entries }))

  const visible: (CrumbSegment | "…")[] = range
    ? [...segments.slice(0, range.start), "…", ...segments.slice(range.end)]
    : segments

  return (
    <nav ref={nav} className={className ? `docs-demo-crumbs ${className}` : "docs-demo-crumbs"} aria-label="Breadcrumb">
      <ol className="docs-demo-crumbs-list">
        {visible.map((item, index) => {
          const hidden = item === "…"
          const id = hidden ? "…" : item.key
          const last = !hidden && item.kind === "file"
          const expanded = menu?.id === id
          const label = hidden ? "Hidden path segments" : item.kind === "src" ? "Demo files" : `Files in ${parentOf(item.path) || "the demo root"}`
          const entries = () => (hidden ? hiddenEntries(paths, segments, range as CrumbRange) : siblingEntries(paths, item))
          return (
            <li key={id} className="docs-demo-crumb-item" data-last={last || undefined}>
              {index > 0 ? <ChevronRight className="docs-demo-crumb-sep" width={12} height={12} aria-hidden="true" /> : null}
              <button
                type="button"
                className="docs-demo-crumb"
                data-crumb-last={last || undefined}
                data-current={last || undefined}
                aria-current={last ? "page" : undefined}
                aria-haspopup="menu"
                aria-expanded={expanded}
                aria-controls={expanded ? menuId : undefined}
                aria-label={hidden ? "Show hidden path segments" : undefined}
                title={hidden ? undefined : item.kind === "src" ? undefined : item.path}
                onClick={(event) => open(id, event.currentTarget, label, entries())}
                onKeyDown={(event) => {
                  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return
                  event.preventDefault()
                  if (!expanded) setMenu({ id, anchor: event.currentTarget, label, entries: entries() })
                }}
              >
                {last ? <FileCode2 width={13} height={13} aria-hidden="true" /> : null}
                <span className="docs-demo-crumb-text">{hidden ? "…" : item.name}</span>
              </button>
            </li>
          )
        })}
      </ol>
      {/* The same segments, unclipped and unseen: measured to decide what fits. */}
      <ol ref={measure} className="docs-demo-crumbs-list docs-demo-crumbs-measure" aria-hidden="true">
        {[...segments.map((s) => s.name), "…"].map((name, index) => (
          <li key={`${index}:${name}`} className="docs-demo-crumb-item">
            {index > 0 ? <ChevronRight className="docs-demo-crumb-sep" width={12} height={12} /> : null}
            <span className="docs-demo-crumb">
              {index === segments.length - 1 ? <FileCode2 width={13} height={13} /> : null}
              <span className="docs-demo-crumb-text">{name}</span>
            </span>
          </li>
        ))}
      </ol>
      {menu ? <CrumbMenu key={menu.id} id={menuId} menu={menu} active={path} onPick={choose} onClose={close} /> : null}
    </nav>
  )
}

function CrumbMenu({ id, menu, active, onPick, onClose }: {
  id: string
  menu: OpenMenu
  active: string
  onPick: (entry: CrumbEntry) => void
  onClose: (refocus: boolean) => void
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const { anchor } = menu
  const [at, setAt] = useState(() => {
    const rect = anchor.getBoundingClientRect()
    return { x: rect.left, y: rect.bottom + 4 }
  })

  // Place under the trigger, kept inside the viewport (flipped above when there is no room below),
  // and focus the current entry.
  useIsoLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = anchor.getBoundingClientRect()
    const { width, height } = el.getBoundingClientRect()
    const x = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
    const below = rect.bottom + 4
    const y = below + height > window.innerHeight - 8 && rect.top - 4 - height >= 8 ? rect.top - 4 - height : below
    setAt({ x, y })
    const items = Array.from(el.querySelectorAll<HTMLElement>("[role=menuitem]"))
    ;(items.find((item) => item.hasAttribute("data-current")) ?? items[0])?.focus({ preventScroll: true })
  }, [anchor])

  useEffect(() => {
    const onDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (!ref.current?.contains(target) && !anchor.contains(target)) onClose(false)
    }
    const onScroll = (event: Event) => {
      if (!ref.current?.contains(event.target as Node)) onClose(false)
    }
    const dismiss = () => onClose(false)
    document.addEventListener("pointerdown", onDown, true)
    window.addEventListener("scroll", onScroll, true)
    window.addEventListener("resize", dismiss)
    return () => {
      document.removeEventListener("pointerdown", onDown, true)
      window.removeEventListener("scroll", onScroll, true)
      window.removeEventListener("resize", dismiss)
    }
  }, [anchor, onClose])

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]"))
    const index = items.indexOf(document.activeElement as HTMLElement)
    let next = -1
    if (event.key === "ArrowDown") next = (index + 1) % items.length
    else if (event.key === "ArrowUp") next = (index - 1 + items.length) % items.length
    else if (event.key === "Home") next = 0
    else if (event.key === "End") next = items.length - 1
    else if (event.key === "Escape") {
      event.preventDefault()
      event.stopPropagation()
      onClose(true)
      return
    } else if (event.key === "Tab") {
      onClose(true) // focus returns to the trigger; the Tab then moves on from there
      return
    } else if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
      const key = event.key.toLowerCase()
      const from = Math.max(index, 0)
      for (let step = 1; step <= items.length; step++) {
        const candidate = (from + step) % items.length
        if (items[candidate].textContent?.trim().toLowerCase().startsWith(key)) {
          next = candidate
          break
        }
      }
    }
    if (next < 0) return
    event.preventDefault()
    items[next]?.focus()
  }

  const host = anchor.closest("[data-docstream], .docs-article") ?? document.body
  return createPortal(
    <div
      ref={ref}
      id={id}
      role="menu"
      aria-label={menu.label}
      className="docs-demo-crumb-menu"
      style={{ "--crumb-x": `${Math.round(at.x)}px`, "--crumb-y": `${Math.round(at.y)}px` } as CSSProperties}
      onKeyDown={onKeyDown}
    >
      {menu.entries.map((entry) => {
        const current = entryContains(entry, active)
        return (
          <button
            key={`${entry.kind}:${entry.path}:${entry.name}`}
            type="button"
            role="menuitem"
            tabIndex={-1}
            className="docs-demo-crumb-option"
            data-current={current || undefined}
            aria-current={current || undefined}
            onClick={() => onPick(entry)}
          >
            {entry.kind === "dir" ? <Folder width={13} height={13} aria-hidden="true" /> : <FileCode2 width={13} height={13} aria-hidden="true" />}
            <span className="docs-demo-crumb-option-text">{entry.name}</span>
            {current ? <Check className="docs-demo-crumb-check" width={13} height={13} aria-hidden="true" /> : null}
          </button>
        )
      })}
    </div>,
    host,
  )
}
