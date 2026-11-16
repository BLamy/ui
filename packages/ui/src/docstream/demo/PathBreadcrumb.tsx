/* The Code view's path header: a VS Code style breadcrumb for the active file.

   One button per path part (the demo `src` first, then the folders, then the file), with a chevron
   between them. A folder button opens a menu of that folder's siblings (everything in its parent
   folder, the current one marked); the file button lists the files beside it. Picking a file selects
   it, picking a folder opens the first file inside it. When the segments don't fit the container the
   middle collapses into a single `…` that lists the hidden segments.

   Every segment is a trigger of one UI SDK menu outside it (a controller shared by the triggers, the segment's id as
   the payload the content renders from), so opening another segment's menu takes the open one over, and it opens on
   the current entry. The menu opens in the top layer,
   so the viewer's overflow never clips it. The segment, sibling and fit maths are pure and exported
   (see PathBreadcrumb.test.ts). */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Menu, MenuContent, MenuItem, MenuTrigger, createMenuController } from "@ui-sdk/react/menu"
import { Glyph } from "../ui/glyph"
import { useOpenOnCurrent } from "../ui/menu-current"

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
  const [menu] = useState(() => createMenuController<string>())
  const openOnCurrent = useOpenOnCurrent('[role="menuitem"][data-current]')
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

  const choose = (entry: CrumbEntry) => {
    onSelect(entry.target)
    // The segments are re-keyed for the new file; park focus on its last segment.
    requestAnimationFrame(() => nav.current?.querySelector<HTMLElement>("[data-crumb-last]")?.focus())
  }

  const visible: (CrumbSegment | "…")[] = range
    ? [...segments.slice(0, range.start), "…", ...segments.slice(range.end)]
    : segments
  const idOf = (item: CrumbSegment | "…") => (item === "…" ? "…" : item.key)
  // The content reads the open segment from the menu's payload: the id of the segment whose trigger opened it.
  const itemOf = (payload: string | undefined) => (payload === undefined ? undefined : visible.find((item) => idOf(item) === payload))
  const labelOf = (item: CrumbSegment | "…" | undefined) => item === undefined ? undefined
    : item === "…" ? "Hidden path segments"
      : item.kind === "src" ? "Demo files" : `Files in ${parentOf(item.path) || "the demo root"}`
  const entriesOf = (item: CrumbSegment | "…" | undefined) => item === undefined ? []
    : item === "…" ? (range ? hiddenEntries(paths, segments, range) : [])
      : siblingEntries(paths, item)

  return (
    <nav ref={nav} className={className ? `docs-demo-crumbs ${className}` : "docs-demo-crumbs"} aria-label="Breadcrumb">
      <Menu controller={menu} onOpenChange={(open) => openOnCurrent.opened(open)} onPayloadChange={() => openOnCurrent.opened()}>
        <MenuContent<string>
          className="docs-demo-crumb-menu"
          side="bottom"
          align="start"
          sideOffset={4}
          collisionPadding={8}
          render={(props, state) => <div {...props} aria-label={labelOf(itemOf(state.payload))} />}
          {...openOnCurrent.content}
        >
          {(state) => entriesOf(itemOf(state.payload)).map((entry) => {
            const current = entryContains(entry, path)
            return (
              <MenuItem
                key={`${entry.kind}:${entry.path}:${entry.name}`}
                value={entry.target}
                label={entry.name}
                className="docs-demo-crumb-option"
                data-current={current || undefined}
                aria-current={current || undefined}
                onSelect={() => choose(entry)}
              >
                {entry.kind === "dir" ? <Glyph name="folder" size={13} /> : <Glyph name="doc-code" size={13} />}
                <span className="docs-demo-crumb-option-text">{entry.name}</span>
                {current ? <Glyph name="check" className="docs-demo-crumb-check" size={13} /> : null}
              </MenuItem>
            )
          })}
        </MenuContent>
      </Menu>
      <ol className="docs-demo-crumbs-list">
        {visible.map((item, index) => {
          const hidden = item === "…"
          const id = idOf(item)
          const last = !hidden && item.kind === "file"
          return (
            <li key={id} className="docs-demo-crumb-item" data-last={last || undefined}>
              {index > 0 ? <Glyph name="chevron-right" className="docs-demo-crumb-sep" size={12} /> : null}
              <MenuTrigger
                controller={menu}
                payload={id}
                className="docs-demo-crumb"
                data-crumb-last={last || undefined}
                data-current={last || undefined}
                aria-current={last ? "page" : undefined}
                aria-label={hidden ? "Show hidden path segments" : undefined}
                title={hidden ? undefined : item.kind === "src" ? undefined : item.path}
              >
                {last ? <Glyph name="doc-code" size={13} /> : null}
                <span className="docs-demo-crumb-text">{hidden ? "…" : item.name}</span>
              </MenuTrigger>
            </li>
          )
        })}
      </ol>
      {/* The same segments, unclipped and unseen: measured to decide what fits. */}
      <ol ref={measure} className="docs-demo-crumbs-list docs-demo-crumbs-measure" aria-hidden="true">
        {[...segments.map((s) => s.name), "…"].map((name, index) => (
          <li key={`${index}:${name}`} className="docs-demo-crumb-item">
            {index > 0 ? <Glyph name="chevron-right" className="docs-demo-crumb-sep" size={12} /> : null}
            <span className="docs-demo-crumb">
              {index === segments.length - 1 ? <Glyph name="doc-code" size={13} /> : null}
              <span className="docs-demo-crumb-text">{name}</span>
            </span>
          </li>
        ))}
      </ol>
    </nav>
  )
}
