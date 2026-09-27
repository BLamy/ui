/* The demo viewer for `{% demo src="<page>/<example>" %}`.

   Where the files come from:
   - a host `DemoResolver` that knows `src`: the component renders in-page; the Code view shows
     the resolver's files (they win over any inline copy);
   - otherwise the block's inline files (`{% demo %}` + fences + `{% enddemo %}`): the Preview
     runs them through the `InlineDemoRuntime` in context (almost-node in the playground entry),
     or, without one, the viewer opens on the Code view with a short note — never an empty box.

   Multi-file demos get the gallery viewer: a header (title, description, Preview | Code, variants,
   viewport widths, copy, fullscreen), a resizable preview frame on a dotted stage, and a Code view
   with a file tree and highlighted source. Single-file demos keep the ReactDemo card: the preview,
   then a collapsible, line-numbered code panel. Either way the component renders in-page (lazy
   `load()`, mounted once the card nears the viewport) and the code shown is the real file. */
import {
  Component,
  createElement,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type MutableRefObject,
} from "react"
import { motion, useReducedMotion } from "framer-motion"
import { ExternalLink, FileCode2, Folder, Maximize2, Monitor, Smartphone, Tablet, X } from "lucide-react"

import type { DemoLayout, DemoNode, DemoViewport } from "../gitbook/ast"
import { parseInline } from "../gitbook/inline"
import { CollapsibleCode } from "../docs/CollapsibleCode"
import { HighlightedCode } from "../docs/HighlightedCode"
import { CopyButton } from "../docs/copy"
import { PillTabs, Segmented, rovingKeyDown } from "../docs/controls"
import { useDemoResolver, useDemoRuntime } from "./context"
import { languageForPath } from "./glob"
import { inlineDemoMarkdown } from "./markdown"
import { cssToSurface, surfaceStyle, surfaceToCss } from "./surface"
import type { DemoComponent, DemoFile, DemoMeta, DemoResolver, DemoVariant, InlineDemoRuntime } from "./types"

export interface DemoViewerProps {
  /** `<page>/<example>` id handed to the resolver. */
  src: string
  /** Defaults to the nearest `demoResolver` provided to a renderer. */
  resolver?: DemoResolver
  title?: string
  description?: string
  /** Preview height (px number, digits, or any CSS length). */
  height?: number | string
  layout?: DemoLayout
  variants?: DemoVariant[]
  /** Initial viewport of the multi-file preview. */
  viewport?: DemoViewport
  /**
   * Files carried inline by the block (entry first unless `entry` says otherwise). Used when
   * no resolver knows `src`, or the resolver fails for it.
   */
  files?: DemoFile[]
  /** Entry among `files`. Defaults to the first file. */
  entry?: string
  /** The block is still streaming in: show its code, but don't run it yet. */
  streaming?: boolean
  /** Runs inline files in the Preview. Defaults to the runtime in context (`demoRuntime`). */
  runtime?: InlineDemoRuntime
  /** Extra npm dependencies for the runtime, merged over `demoDependencies` from context. */
  dependencies?: Record<string, string>
  /** Class on the viewer's outer element. (The preview canvas's class is `canvasClassName`.) */
  className?: string
  /*
   * Look. Each falls back to the resolver's `meta.json` field of the same name when unset —
   * props (a `{% demo %}` tag's attributes) win over `meta.json`, which wins over the
   * defaults — so a copied page renders the same with or without the resolver.
   */
  /** Status shown in the header (`meta.status`). */
  status?: string
  /** Full-bleed canvas without the padded surface (`meta.bleed`). */
  bleed?: boolean
  /** Extra class on the preview canvas (`meta.className`). */
  canvasClassName?: string
  /** Canvas inline style: an object like `meta.surface`, or CSS declarations as in the tag's `surface`. */
  surface?: Record<string, string | number> | string
  /** Width of the variant switch (`meta.variantsWidth`). */
  variantsWidth?: number | string
}

/* ---------- data ---------- */

type Loaded<T> = { status: "loading" } | { status: "ready"; value: T } | { status: "error"; error: Error }

const settled = new WeakMap<DemoResolver, Map<string, Loaded<unknown>>>()
function cacheFor(resolver: DemoResolver) {
  let cache = settled.get(resolver)
  if (!cache) settled.set(resolver, (cache = new Map()))
  return cache
}

/**
 * Resolve demos ahead of rendering (meta, files and component), so the first render — including
 * server rendering and static export — shows them resolved instead of loading. Failures are
 * remembered too, so inline-file fallbacks apply immediately.
 */
export async function preloadDemos(resolver: DemoResolver, srcs: string[]): Promise<void> {
  const cache = cacheFor(resolver)
  const settle = async (key: string, run: () => Promise<unknown>) => {
    try {
      cache.set(key, { status: "ready", value: await run() })
    } catch (cause) {
      cache.set(key, { status: "error", error: cause instanceof Error ? cause : new Error(String(cause)) })
    }
  }
  await Promise.all(
    srcs.flatMap((src) => [
      settle(`meta:${src}`, () => resolver.meta(src)),
      settle(`files:${src}`, () => resolver.files(src)),
      settle(`load:${src}`, () => resolver.load(src)),
    ]),
  )
}

/** Resolves `run()` once `active`, remembering settled values so remounts don't flash. */
function useResolved<T>(resolver: DemoResolver | undefined, key: string, active: boolean, run: () => Promise<T>): Loaded<T> {
  const cached = resolver ? (cacheFor(resolver).get(key) as Loaded<T> | undefined) : undefined
  const [state, setState] = useState<Loaded<T>>(cached ?? { status: "loading" })
  useEffect(() => {
    if (!resolver) return
    const hit = cacheFor(resolver).get(key) as Loaded<T> | undefined
    if (hit && hit.status !== "loading") {
      setState(hit)
      return
    }
    if (!active) {
      setState({ status: "loading" })
      return
    }
    let live = true
    run().then(
      (value) => {
        const next: Loaded<T> = { status: "ready", value }
        cacheFor(resolver).set(key, next)
        if (live) setState(next)
      },
      (cause: unknown) => {
        const error = cause instanceof Error ? cause : new Error(String(cause))
        if (live) setState({ status: "error", error })
      },
    )
    return () => {
      live = false
    }
    // `run` closes over resolver + key only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolver, key, active])
  return state
}

const useMeta = (resolver: DemoResolver | undefined, src: string) =>
  useResolved<DemoMeta | undefined>(resolver, `meta:${src}`, true, () => resolver!.meta(src))
const useFiles = (resolver: DemoResolver | undefined, src: string, active: boolean) =>
  useResolved<DemoFile[]>(resolver, `files:${src}`, active, () => resolver!.files(src))
const useComponent = (resolver: DemoResolver | undefined, src: string, active: boolean) =>
  useResolved<DemoComponent>(resolver, `load:${src}`, active, () => resolver!.load(src))

/** True once the element has come within `margin` of the viewport (stays true). */
function useNearViewport<T extends Element>(margin = "400px 0px") {
  const ref = useRef<T | null>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || near) return
    if (typeof IntersectionObserver === "undefined") {
      setNear(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setNear(true)
    }, { rootMargin: margin })
    observer.observe(el)
    return () => observer.disconnect()
  }, [near, margin])
  return [ref, near] as const
}

/* ---------- pieces ---------- */

class DemoErrorBoundary extends Component<{ src: string; children?: ReactNode }, { error: Error | null }> {
  override state: { error: Error | null } = { error: null }
  static getDerivedStateFromError(error: unknown) {
    return { error: error instanceof Error ? error : new Error(String(error)) }
  }
  override componentDidUpdate(prev: { src: string }) {
    if (prev.src !== this.props.src && this.state.error) this.setState({ error: null })
  }
  override render() {
    return this.state.error ? <DemoError message={`${this.props.src} failed to render: ${this.state.error.message}`} /> : this.props.children
  }
}

function DemoError({ message }: { message: string }) {
  return <pre className="docs-demo-error" role="alert">{message}</pre>
}

function Spinner({ label = "Loading demo" }: { label?: string }) {
  return (
    <div className="docs-demo-loading" role="status" aria-label={label}>
      <span className="docs-demo-spinner" aria-hidden="true" />
    </div>
  )
}

/** Descriptions allow inline Markdown (`code`, **bold**, _em_, links). */
function InlineMarkdown({ text }: { text: string }) {
  const nodes = useMemo(() => parseInline(text), [text])
  return (
    <>
      {nodes.map((n, i) => {
        if (n.type !== "text") return null
        let el: ReactNode = n.text
        if (n.code) el = <code>{el}</code>
        if (n.bold) el = <strong>{el}</strong>
        if (n.italic) el = <em>{el}</em>
        if (n.link) el = <a href={n.link}>{el}</a>
        return <span key={i}>{el}</span>
      })}
    </>
  )
}

function cssLength(value: number | string | undefined, fallback: string): string {
  if (value === undefined || value === "") return fallback
  if (typeof value === "number") return `${value}px`
  return /^\d+(?:\.\d+)?$/.test(value.trim()) ? `${value.trim()}px` : value
}

/** What fills the preview: a resolved component, an inline-demo runtime, or a note. */
type PreviewSource =
  | { kind: "component"; component: Loaded<DemoComponent> }
  | { kind: "runtime"; render: (variant: string | undefined) => ReactNode }
  | { kind: "streaming" }
  | { kind: "unavailable" }

export const NO_RUNTIME_NOTE = "Live preview needs the playground runtime. The code is shown instead."

/** The rendered demo on its canvas. */
/** The canvas's class and inline style from `meta.className` / `meta.surface`. */
interface CanvasLook {
  className?: string
  surface?: Record<string, string | number>
}

function DemoCanvas({ src, preview, variant, bleed, look }: {
  src: string
  preview: PreviewSource
  variant: string | undefined
  bleed?: boolean
  look?: CanvasLook
}) {
  if (preview.kind === "unavailable" || preview.kind === "streaming") {
    return (
      <div className="docs-demo-note" role="note" data-variant={variant}>
        {preview.kind === "streaming" ? "The demo is still arriving; its preview starts once the block is complete." : NO_RUNTIME_NOTE}
      </div>
    )
  }
  if (preview.kind === "runtime") {
    return (
      <div
        className={["docs-demo-canvas docs-demo-canvas-bleed docs-demo-canvas-runtime", look?.className ?? ""].filter(Boolean).join(" ")}
        style={surfaceStyle(look?.surface)}
        data-variant={variant}
      >
        <DemoErrorBoundary src={src || "demo"}>{preview.render(variant)}</DemoErrorBoundary>
      </div>
    )
  }
  const { component } = preview
  return (
    <div
      className={["docs-demo-canvas", bleed ? "docs-demo-canvas-bleed" : "", look?.className ?? ""].filter(Boolean).join(" ")}
      style={surfaceStyle(look?.surface)}
      data-variant={variant}
    >
      {component.status === "ready" ? (
        <DemoErrorBoundary src={src}>
          {createElement(component.value, variant === undefined ? {} : { variant })}
        </DemoErrorBoundary>
      ) : component.status === "error" ? (
        <DemoError message={`${src} failed to load: ${component.error.message}`} />
      ) : (
        <Spinner />
      )}
    </div>
  )
}

const VIEWPORTS: { id: DemoViewport; label: string; width: number | null; Icon: typeof Monitor }[] = [
  { id: "desktop", label: "Desktop", width: null, Icon: Monitor },
  { id: "tablet", label: "Tablet", width: 768, Icon: Tablet },
  { id: "phone", label: "Phone", width: 390, Icon: Smartphone },
]
const MIN_WIDTH = 280

/** The resizable preview frame on its stage. `width === null` fills the stage. */
function PreviewStage({ width, onResize, height, children }: {
  width: number | null
  onResize: (width: number | null) => void
  height: string
  children: ReactNode
}) {
  const reduced = useReducedMotion()
  const frame = useRef<HTMLDivElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [measured, setMeasured] = useState<number | null>(null)
  const [max, setMax] = useState<number>(0)

  useEffect(() => {
    const el = frame.current
    if (!el || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => {
      setMeasured(Math.round(el.getBoundingClientRect().width))
      setMax(el.parentElement?.clientWidth ?? 0)
    })
    observer.observe(el)
    if (el.parentElement) observer.observe(el.parentElement)
    return () => observer.disconnect()
  }, [])

  const clamp = (next: number) => {
    const limit = frame.current?.parentElement?.clientWidth ?? next
    const value = Math.round(Math.min(limit, Math.max(MIN_WIDTH, next)))
    return value >= limit - 4 ? null : value
  }

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const el = frame.current
    if (!el || event.button !== 0) return
    event.preventDefault()
    const left = el.getBoundingClientRect().left
    setDragging(true)
    const move = (ev: PointerEvent) => onResize(clamp(ev.clientX - left))
    const up = () => {
      setDragging(false)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const current = width ?? measured ?? max
    const step = event.shiftKey ? 50 : 10
    let next: number | null | undefined
    if (event.key === "ArrowLeft") next = clamp(current - step)
    else if (event.key === "ArrowRight") next = clamp(current + step)
    else if (event.key === "Home") next = clamp(MIN_WIDTH)
    else if (event.key === "End") next = null
    if (next === undefined) return
    event.preventDefault()
    onResize(next)
  }

  return (
    <div className="docs-demo-stage" style={{ height }} data-dragging={dragging || undefined}>
      <motion.div
        ref={frame}
        className="docs-demo-frame"
        data-sized={width !== null || undefined}
        initial={false}
        animate={{ width: width ?? "100%" }}
        transition={dragging || reduced ? { duration: 0 } : { type: "spring", bounce: 0.12, duration: 0.5 }}
      >
        {children}
      </motion.div>
      <div
        className="docs-demo-handle"
        role="separator"
        tabIndex={0}
        aria-orientation="vertical"
        aria-label="Resize preview"
        aria-valuemin={MIN_WIDTH}
        aria-valuemax={max || undefined}
        aria-valuenow={measured ?? undefined}
        aria-valuetext={measured ? `${measured} pixels wide` : undefined}
        data-dragging={dragging || undefined}
        onPointerDown={startDrag}
        onKeyDown={onKeyDown}
        onDoubleClick={() => onResize(null)}
      />
      <span className="docs-demo-readout" aria-hidden="true">{measured ? `${measured}px` : ""}</span>
    </div>
  )
}

interface TreeRow {
  kind: "dir" | "file"
  name: string
  depth: number
  path: string
}

/** Files as a tree: the entry and root files first, then each folder with its files indented. */
function fileTree(files: DemoFile[]): TreeRow[] {
  const rows: TreeRow[] = []
  const seen = new Set<string>()
  for (const file of files) {
    const parts = file.path.split("/")
    for (let d = 0; d < parts.length - 1; d++) {
      const dir = parts.slice(0, d + 1).join("/")
      if (!seen.has(dir)) {
        seen.add(dir)
        rows.push({ kind: "dir", name: parts[d], depth: d, path: dir })
      }
    }
    rows.push({ kind: "file", name: parts[parts.length - 1], depth: parts.length - 1, path: file.path })
  }
  return rows
}

function CodeView({ src, files, height, id }: { src: string; files: DemoFile[]; height: string; id: string }) {
  const [active, setActive] = useState(files[0]?.path ?? "")
  useEffect(() => {
    if (!files.some((f) => f.path === active)) setActive(files[0]?.path ?? "")
  }, [files, active])
  const file = files.find((f) => f.path === active) ?? files[0]
  const rows = useMemo(() => fileTree(files), [files])
  const paths = files.map((f) => f.path)
  const tabId = (path: string) => `${id}-file-${paths.indexOf(path)}`
  const panelId = `${id}-source`
  return (
    <div className="docs-demo-code" style={{ height }}>
      <div
        className="docs-demo-files"
        role="tablist"
        aria-orientation="vertical"
        aria-label="Files"
        onKeyDown={(event) => rovingKeyDown(event, paths, active, setActive, "vertical")}
      >
        <div className="docs-demo-files-h" aria-hidden="true">Files</div>
        {rows.map((row) =>
          row.kind === "dir" ? (
            <div key={`d:${row.path}`} className="docs-demo-dir" style={{ "--depth": row.depth } as CSSProperties} aria-hidden="true">
              <Folder width={13} height={13} aria-hidden="true" />
              {row.name}
            </div>
          ) : (
            <button
              key={row.path}
              id={tabId(row.path)}
              type="button"
              role="tab"
              data-roving=""
              aria-selected={row.path === active}
              aria-controls={panelId}
              tabIndex={row.path === active ? 0 : -1}
              title={row.path}
              className="docs-demo-file"
              style={{ "--depth": row.depth } as CSSProperties}
              onClick={() => setActive(row.path)}
            >
              <FileCode2 width={13} height={13} aria-hidden="true" />
              <span>{row.name}</span>
            </button>
          ),
        )}
      </div>
      <div className="docs-demo-source" role="tabpanel" id={panelId} aria-labelledby={file ? tabId(file.path) : undefined}>
        <div className="docs-demo-source-h">
          <span className="docs-demo-source-path">{src && file ? `${src}/${file.path}` : file?.path}</span>
          {file ? <CopyButton text={file.content} label={`Copy ${file.path}`} /> : null}
        </div>
        <div className="docs-demo-source-body" tabIndex={0} aria-label={file ? `${file.path} source` : undefined}>
          {file ? (
            <pre className="docs-code-numbered">
              <HighlightedCode code={file.content.replace(/\n+$/, "")} language={file.language ?? languageForPath(file.path) ?? null} lineNumbers />
            </pre>
          ) : (
            <Spinner label="Loading files" />
          )}
        </div>
      </div>
    </div>
  )
}

function FullscreenButton({ onOpen, title }: { onOpen: () => void; title: string }) {
  return (
    <button type="button" className="docs-demo-icon-btn" onClick={onOpen} aria-label={`Open ${title} fullscreen`} title="Fullscreen">
      <Maximize2 width={15} height={15} aria-hidden="true" />
    </button>
  )
}

function NewTabLink({ href, title }: { href: string | undefined; title: string }) {
  if (!href) return null
  return (
    <a className="docs-demo-icon-btn" href={href} target="_blank" rel="noreferrer" aria-label={`Open ${title} in a new tab`} title="Open in new tab">
      <ExternalLink width={15} height={15} aria-hidden="true" />
    </a>
  )
}

function VariantSwitch({ variants, value, onChange, title, width }: {
  variants: DemoVariant[] | undefined
  value: string | undefined
  onChange: (id: string) => void
  title: string
  width?: number | string
}) {
  if (!variants?.length || value === undefined) return null
  return (
    <Segmented
      options={variants}
      value={value}
      onChange={onChange}
      label={`${title} variant`}
      className={width === undefined ? "docs-demo-variants" : "docs-demo-variants docs-demo-variants-sized"}
      style={width === undefined ? undefined : { width: cssLength(width, "auto") }}
    />
  )
}

function StatusBadge({ status }: { status: string | undefined }) {
  return status ? <span className="docs-demo-status">{status}</span> : null
}

/** A full-viewport overlay (native modal dialog: top layer, focus trap, Esc to close). */
function FullscreenDialog({ open, onClose, title, src, variants, variant, onVariant, preview, bleed, look, variantsWidth, href }: {
  open: boolean
  onClose: () => void
  title: string
  src: string
  variants: DemoVariant[] | undefined
  variant: string | undefined
  onVariant: (id: string) => void
  preview: PreviewSource
  bleed?: boolean
  look?: CanvasLook
  variantsWidth?: number | string
  href?: string
}) {
  const ref = useRef<HTMLDialogElement | null>(null)
  const titleId = useId()
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal()
      else dialog.setAttribute("open", "")
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])
  return (
    <dialog ref={ref} className="docs-demo-dialog" aria-labelledby={titleId} onClose={onClose} onCancel={onClose}>
      {open ? (
        <div className="docs-demo-dialog-inner">
          <div className="docs-demo-dialog-bar">
            <span id={titleId} className="docs-demo-title">{title}</span>
            <span className="docs-demo-dialog-src">{src}</span>
            <span className="docs-demo-spacer" />
            <VariantSwitch variants={variants} value={variant} onChange={onVariant} title={title} width={variantsWidth} />
            <NewTabLink href={href} title={title} />
            <button type="button" className="docs-demo-icon-btn" onClick={onClose} aria-label="Close fullscreen" title="Close (Esc)" autoFocus>
              <X width={16} height={16} aria-hidden="true" />
            </button>
          </div>
          <div className="docs-demo-dialog-stage">
            <DemoCanvas src={src} preview={preview} variant={variant} bleed={bleed} look={look} />
          </div>
        </div>
      ) : null}
    </dialog>
  )
}

/* ---------- viewer ---------- */

type ViewTab = "preview" | "code"

/** Inline files, entry first. */
function orderInline(files: DemoFile[] | undefined, entry: string | undefined): DemoFile[] | undefined {
  if (!files?.length) return undefined
  const index = entry ? files.findIndex((f) => f.path === entry) : -1
  return index > 0 ? [files[index], ...files.slice(0, index), ...files.slice(index + 1)] : files
}

export function DemoViewer(props: DemoViewerProps) {
  const resolver = useDemoResolver(props.resolver)
  const runtimeOptions = useDemoRuntime({ runtime: props.runtime, dependencies: props.dependencies })
  const { src } = props
  const [ref, near] = useNearViewport<HTMLElement>()
  const inlineFiles = useMemo(() => orderInline(props.files, props.entry), [props.files, props.entry])

  // A resolver is consulted unless the block brings its own files and the resolver
  // says (via `list()`) that it does not know this src.
  const tryResolver = !!resolver && !(inlineFiles && (!src || (resolver.list ? !resolver.list().includes(src) : false)))
  const hookResolver = tryResolver ? resolver : undefined
  const meta = useMeta(hookResolver, src)
  const resolvedFiles = useFiles(hookResolver, src, near)
  const component = useComponent(hookResolver, src, near)
  const resolverFailed = meta.status === "error" || resolvedFiles.status === "error" || component.status === "error"
  const mode: "resolver" | "inline" | "none" =
    tryResolver && !(inlineFiles && resolverFailed) ? "resolver" : inlineFiles ? "inline" : "none"

  const metaValue = mode === "resolver" && meta.status === "ready" ? meta.value : undefined
  const files: Loaded<DemoFile[]> = mode === "inline" ? { status: "ready", value: inlineFiles! } : resolvedFiles
  const title = props.title ?? metaValue?.title ?? (src.split("/").pop() || "Demo")
  const description = props.description ?? metaValue?.description
  const variants = props.variants?.length ? props.variants : metaValue?.variants
  const [chosenVariant, setVariant] = useState<string | undefined>(undefined)
  const variant = variants?.length
    ? (variants.some((v) => v.id === chosenVariant) ? chosenVariant : variants[0].id)
    : undefined
  const layoutPref = props.layout ?? metaValue?.layout ?? "auto"
  const fileList = files.status === "ready" ? files.value : null
  const layout: "single" | "multi" | null =
    layoutPref !== "auto" ? layoutPref : fileList ? (fileList.length > 1 ? "multi" : "single") : null
  const heightValue = props.height ?? metaValue?.height
  // Look: the tag's attributes (props) first, then `meta.json`.
  const bleed = props.bleed ?? metaValue?.bleed
  const propSurface = typeof props.surface === "string" ? cssToSurface(props.surface) : props.surface
  const look: CanvasLook = {
    className: props.canvasClassName ?? metaValue?.className,
    surface: propSurface ?? metaValue?.surface,
  }
  const variantsWidth = props.variantsWidth ?? metaValue?.variantsWidth
  const status = props.status ?? metaValue?.status
  const [fullscreen, setFullscreen] = useState(false)
  const href = mode === "resolver" ? resolver?.href?.(src, variant ? { variant } : undefined) : undefined
  const baseId = useId()

  const { runtime, dependencies } = runtimeOptions
  const preview: PreviewSource = useMemo(() => {
    if (mode !== "inline") return { kind: "component", component }
    if (props.streaming) return { kind: "streaming" }
    if (!runtime || !inlineFiles) return { kind: "unavailable" }
    const entry = inlineFiles[0].path
    return { kind: "runtime", render: (v) => runtime({ src, title, files: inlineFiles, entry, variant: v, dependencies }) }
  }, [mode, component, props.streaming, runtime, inlineFiles, src, title, dependencies])
  const runnable = preview.kind !== "unavailable"

  if (mode === "none") {
    return (
      <div className="docs-source-ref" data-docstream-demo="" data-demo-src={src}>
        <FileCode2 width={16} height={16} aria-hidden="true" />
        <span>{title}</span>
        <code>demo:{src}</code>
      </div>
    )
  }

  const node: DemoNode = {
    type: "demo",
    src,
    ...(props.title ? { title: props.title } : {}),
    ...(props.description ? { description: props.description } : {}),
    ...(props.height !== undefined ? { height: String(props.height) } : {}),
    ...(props.layout ? { layout: props.layout } : {}),
    ...(props.variants?.length ? { variants: props.variants } : {}),
    ...(props.viewport ? { viewport: props.viewport } : {}),
    ...(props.status ? { status: props.status } : {}),
    ...(props.bleed !== undefined ? { bleed: props.bleed } : {}),
    ...(props.canvasClassName ? { className: props.canvasClassName } : {}),
    ...(props.surface ? { surface: typeof props.surface === "string" ? props.surface : surfaceToCss(props.surface) } : {}),
    ...(props.variantsWidth !== undefined && props.variantsWidth !== "" ? { variantsWidth: String(props.variantsWidth) } : {}),
  }
  const copyDemo = () => inlineDemoMarkdown(node, fileList ?? [], metaValue)

  const dialog = (
    <FullscreenDialog
      open={fullscreen}
      onClose={() => setFullscreen(false)}
      title={title}
      src={src}
      variants={variants}
      variant={variant}
      onVariant={setVariant}
      preview={preview}
      bleed={bleed}
      look={look}
      variantsWidth={variantsWidth}
      href={href}
    />
  )
  const wrapper = (kind: string) => ["docs-demo", `docs-demo-${kind}`, props.className].filter(Boolean).join(" ")

  if (layout === "single") {
    const file = fileList?.[0]
    return (
      <section ref={ref} className={wrapper("single")} data-docstream-demo="" data-demo-src={src} data-demo-mode={mode} aria-labelledby={`${baseId}-title`}>
        <div className="docs-react-demo">
          <header className="docs-react-demo-header docs-demo-single-head">
            <span className="docs-demo-heading">
              <span id={`${baseId}-title`} className="docs-demo-title">{title}</span>
              {description ? <span className="docs-demo-desc"><InlineMarkdown text={description} /></span> : null}
            </span>
            <span className="docs-demo-spacer" />
            <StatusBadge status={status} />
            <VariantSwitch variants={variants} value={variant} onChange={setVariant} title={title} width={variantsWidth} />
            {runnable ? <FullscreenButton onOpen={() => setFullscreen(true)} title={title} /> : null}
          </header>
          {runnable ? (
            <div
              className="docs-react-demo-preview docs-demo-single-preview"
              // A hint, not a cap: in-page components may grow past it (no height: size to content;
              // hosts may set a floor with --docs-demo-preview-min-height). An iframe needs a real height.
              style={
                preview.kind === "runtime"
                  ? { height: cssLength(heightValue, "360px") }
                  : heightValue === undefined || heightValue === ""
                    ? undefined
                    : { minHeight: cssLength(heightValue, "0px") }
              }
            >
              {near ? <DemoCanvas src={src} preview={preview} variant={variant} bleed={bleed} look={look} /> : <Spinner />}
            </div>
          ) : (
            <DemoCanvas src={src} preview={preview} variant={variant} />
          )}
          {file ? (
            <CollapsibleCode
              code={file.content.replace(/\n+$/, "")}
              language={file.language ?? languageForPath(file.path) ?? null}
              copyLabel={`Copy ${file.path}`}
              {...(runnable ? {} : { collapsedLines: 12 })}
            />
          ) : null}
        </div>
        {dialog}
      </section>
    )
  }

  return (
    <MultiFileViewer
      rootRef={ref}
      className={wrapper(layout ?? "pending")}
      baseId={baseId}
      mode={mode}
      src={src}
      title={title}
      description={description}
      variants={variants}
      variant={variant}
      onVariant={setVariant}
      files={files}
      preview={preview}
      near={near}
      height={cssLength(heightValue, "480px")}
      viewport={props.viewport}
      bleed={bleed}
      look={look}
      status={status}
      variantsWidth={variantsWidth}
      href={href}
      onFullscreen={() => setFullscreen(true)}
      copyDemo={fileList?.length ? copyDemo : undefined}
      dialog={dialog}
    />
  )
}

function MultiFileViewer({ rootRef, className, baseId, mode, src, title, description, variants, variant, onVariant, files, preview, near, height, viewport, bleed, look, status, variantsWidth, href, onFullscreen, copyDemo, dialog }: {
  rootRef: MutableRefObject<HTMLElement | null>
  className: string
  baseId: string
  mode: "resolver" | "inline"
  src: string
  title: string
  description: string | undefined
  variants: DemoVariant[] | undefined
  variant: string | undefined
  onVariant: (id: string) => void
  files: Loaded<DemoFile[]>
  preview: PreviewSource
  near: boolean
  height: string
  viewport: DemoViewport | undefined
  bleed: boolean | undefined
  look: CanvasLook | undefined
  status: string | undefined
  variantsWidth: number | string | undefined
  href: string | undefined
  onFullscreen: () => void
  copyDemo: (() => string) | undefined
  dialog: ReactNode
}) {
  const runnable = preview.kind !== "unavailable"
  // Nothing to preview without a runtime: open on the code rather than an empty frame.
  const [tab, setTab] = useState<ViewTab>(runnable ? "preview" : "code")
  const [width, setWidth] = useState<number | null>(() => VIEWPORTS.find((v) => v.id === viewport)?.width ?? null)
  const [codeSeen, setCodeSeen] = useState(false)
  useEffect(() => {
    if (tab === "code") setCodeSeen(true)
  }, [tab])
  const activeViewport = width === null ? "desktop" : VIEWPORTS.find((v) => v.width === width)?.id

  return (
    <section ref={rootRef} className={className} data-docstream-demo="" data-demo-src={src} data-demo-mode={mode} aria-labelledby={`${baseId}-title`}>
      <div className="docs-demo-head">
        <div className="docs-demo-heading">
          <div id={`${baseId}-title`} className="docs-demo-title">{title}</div>
          {description ? <p className="docs-demo-desc"><InlineMarkdown text={description} /></p> : null}
        </div>
        <div className="docs-demo-tools">
          <PillTabs
            options={[{ id: "preview", label: "Preview" }, { id: "code", label: "Code" }] as const}
            value={tab}
            onChange={setTab}
            label={`${title} view`}
            tabId={(id) => `${baseId}-tab-${id}`}
            panelId={(id) => `${baseId}-panel-${id}`}
          />
          <StatusBadge status={status} />
          <VariantSwitch variants={variants} value={variant} onChange={onVariant} title={title} width={variantsWidth} />
          {tab === "preview" && runnable ? (
            <div className="docs-demo-viewports" role="group" aria-label="Preview width">
              {VIEWPORTS.map(({ id, label, width: w, Icon }) => (
                <button
                  key={id}
                  type="button"
                  className="docs-demo-vp"
                  aria-pressed={activeViewport === id}
                  aria-label={w ? `${label} (${w}px)` : label}
                  title={w ? `${label} · ${w}px` : label}
                  onClick={() => setWidth(w)}
                >
                  <Icon width={15} height={15} aria-hidden="true" />
                </button>
              ))}
            </div>
          ) : null}
          {copyDemo ? <CopyButton text={copyDemo} label="Copy demo as Markdown" className="docs-demo-icon-btn" /> : null}
          {runnable ? <FullscreenButton onOpen={onFullscreen} title={title} /> : null}
          <NewTabLink href={href} title={title} />
        </div>
      </div>
      <div className="docs-demo-body">
        <div id={`${baseId}-panel-preview`} role="tabpanel" aria-labelledby={`${baseId}-tab-preview`} hidden={tab !== "preview"}>
          {runnable ? (
            <PreviewStage width={width} onResize={setWidth} height={height}>
              {near ? <DemoCanvas src={src} preview={preview} variant={variant} bleed={bleed} look={look} /> : <Spinner />}
            </PreviewStage>
          ) : (
            <DemoCanvas src={src} preview={preview} variant={variant} />
          )}
        </div>
        <div id={`${baseId}-panel-code`} role="tabpanel" aria-labelledby={`${baseId}-tab-code`} hidden={tab !== "code"}>
          {!runnable && tab === "code" ? <DemoCanvas src={src} preview={preview} variant={variant} /> : null}
          {codeSeen || tab === "code" ? (
            files.status === "ready" ? (
              <CodeView src={src} files={files.value} height={height} id={baseId} />
            ) : files.status === "error" ? (
              <DemoError message={`${src}: ${files.error.message}`} />
            ) : (
              <div className="docs-demo-code" style={{ height }}><Spinner label="Loading files" /></div>
            )
          ) : null}
        </div>
      </div>
      {dialog}
    </section>
  )
}

/** Renders a parsed `{% demo %}` block with the resolver and runtime from context. */
export function DemoBlock({ node }: { node: DemoNode }) {
  return (
    <DemoViewer
      src={node.src}
      title={node.title}
      description={node.description}
      height={node.height}
      layout={node.layout}
      variants={node.variants}
      viewport={node.viewport}
      files={node.files}
      entry={node.entry}
      streaming={node.open}
      status={node.status}
      bleed={node.bleed}
      canvasClassName={node.className}
      surface={node.surface}
      variantsWidth={node.variantsWidth}
    />
  )
}

export interface DemoFullscreenProps {
  src: string
  resolver?: DemoResolver
  variant?: string
  className?: string
  style?: CSSProperties
}

/** One demo filling the viewport, for a `?demo=<src>` deep link the host routes. */
export function DemoFullscreen({ src, resolver: override, variant, className, style }: DemoFullscreenProps) {
  const resolver = useDemoResolver(override)
  const meta = useMeta(resolver, src)
  const component = useComponent(resolver, src, true)
  const metaValue = meta.status === "ready" ? meta.value : undefined
  const chosen = variant ?? metaValue?.variants?.[0]?.id
  if (!resolver) return <DemoError message={`No demo resolver for ${src}`} />
  return (
    <div className={className ? `docs-demo-fullscreen ${className}` : "docs-demo-fullscreen"} style={style} data-demo-src={src}>
      <DemoCanvas src={src} preview={{ kind: "component", component }} variant={chosen} bleed={metaValue?.bleed} look={metaValue} />
    </div>
  )
}
