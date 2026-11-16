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
  type ReactNode,
  type Ref,
} from "react"
import { Dialog, DialogClose, DialogContent, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog"
import { createResizableController, Resizable, ResizableHandle, ResizablePanel } from "@ui-sdk/react/resizable"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs"
import { Toggle, ToggleGroup } from "@ui-sdk/react/toggle"
import { Glyph } from "../ui/glyph"
import { type IconName } from "@brett_lamy/ui/lib/icon"

import type { DemoLayout, DemoNode, DemoViewport } from "../gitbook/ast"
import { parseInline } from "../gitbook/inline"
import { CollapsibleCode } from "../docs/CollapsibleCode"
import { HighlightedCode } from "../docs/HighlightedCode"
import { CopyButton } from "../docs/copy"
import { PillTabsList, Segmented } from "../docs/controls"
import { DocstreamDemoContext, useDemoResolver, useDemoRuntime } from "./context"
import { createDocstreamClipboard, type DemoSourceSnapshot, type DocstreamClipboard } from "./clipboard"
import { CopyDemoButton } from "./copy-demo"
import { PathBreadcrumb } from "./PathBreadcrumb"
import { languageForPath } from "./glob"
import { useDemoVFSContext, useDemoVFSEntry, type DemoVFS } from "./vfs"
import { cssToSurface, surfaceStyle, surfaceToCss } from "./surface"
import { EnvGate, useEnvGate } from "../doc-env"
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
  /**
   * Demo files held in memory by `src` (pasted demos). Used, like inline files, when the block
   * has none of its own and no resolver knows `src`. Defaults to the VFS in context (`demoVFS`).
   */
  vfs?: DemoVFS
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

/**
 * Fetch demos' meta and files (not their components) into the viewer's cache, so
 * `peekDemoSource` can answer synchronously — e.g. when a copy event needs a demo's files.
 */
export async function prefetchDemoSources(resolver: DemoResolver, srcs: string[]): Promise<void> {
  const cache = cacheFor(resolver)
  const settle = async (key: string, run: () => Promise<unknown>) => {
    if (cache.get(key)?.status === "ready") return
    try {
      cache.set(key, { status: "ready", value: await run() })
    } catch (cause) {
      cache.set(key, { status: "error", error: cause instanceof Error ? cause : new Error(String(cause)) })
    }
  }
  await Promise.all(srcs.flatMap((src) => [settle(`meta:${src}`, () => resolver.meta(src)), settle(`files:${src}`, () => resolver.files(src))]))
}

/** A demo's files (and meta) if the resolver has already delivered them (viewer, `preloadDemos`, `prefetchDemoSources`). */
export function peekDemoSource(resolver: DemoResolver, src: string): DemoSourceSnapshot | undefined {
  const cache = settled.get(resolver)
  const files = cache?.get(`files:${src}`)
  if (files?.status !== "ready" || !(files.value as DemoFile[]).length) return undefined
  const meta = cache?.get(`meta:${src}`)
  return { files: files.value as DemoFile[], ...(meta?.status === "ready" && meta.value ? { meta: meta.value as DemoMeta } : {}) }
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
  // A callback ref, so an element that appears later (a VFS demo arriving) is observed too.
  const [el, setEl] = useState<T | null>(null)
  const ref = useMemo(() => (node: T | null) => setEl(node), [])
  const [near, setNear] = useState(false)
  useEffect(() => {
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
  }, [el, near, margin])
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
  | { kind: "env"; names: readonly string[]; title: string }

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
  if (preview.kind === "env") {
    return (
      <div className="docs-demo-canvas docs-demo-canvas-env" data-variant={variant}>
        <EnvGate names={preview.names} title={preview.title} />
      </div>
    )
  }
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

const VIEWPORTS: { id: DemoViewport; label: string; width: number | null; icon: IconName }[] = [
  { id: "desktop", label: "Desktop", width: null, icon: "display" },
  { id: "tablet", label: "Tablet", width: 768, icon: "ipad" },
  { id: "phone", label: "Phone", width: 390, icon: "iphone" },
]
const MIN_WIDTH = 280
const VIEW_TABS: { id: ViewTab; label: string }[] = [{ id: "preview", label: "Preview" }, { id: "code", label: "Code" }]

/** The resizable preview frame on its stage: UI SDK's resizable, the frame and an empty stretch of stage
 *  beside it. `width === null` fills the stage. */
function PreviewStage({ width, onResize, height, children }: {
  width: number | null
  onResize: (width: number | null) => void
  height: string
  children: ReactNode
}) {
  const stage = useRef<HTMLDivElement | null>(null)
  const [resizable] = useState(() => createResizableController())
  const [measured, setMeasured] = useState<number | null>(null)
  // The width this stage last reported, so the effect below doesn't push a drag's own result back.
  const reported = useRef<number | null | undefined>(undefined)

  useEffect(() => {
    const el = stage.current
    const frame = el?.querySelector<HTMLElement>(".docs-demo-frame")
    if (!el || !frame || typeof ResizeObserver === "undefined") return
    const observer = new ResizeObserver(() => setMeasured(Math.round(frame.getBoundingClientRect().width) || null))
    observer.observe(frame)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (reported.current === width) return
    reported.current = width
    if (width === null) resizable.setLayout([100, 0])
    else resizable.resize(0, `${width}px`)
  }, [width, resizable])

  const onLayoutChange = (layout: number[], details: { reason: string }) => {
    if (details.reason !== "drag" && details.reason !== "step-key") return
    const total = stage.current?.getBoundingClientRect().width ?? 0
    const px = Math.round(((layout[0] ?? 100) / 100) * total)
    const next = layout[0] >= 99.5 || (total > 0 && px >= total - 4) ? null : px
    reported.current = next
    onResize(next)
  }

  return (
    <Resizable
      ref={stage}
      className="docs-demo-stage"
      style={{ height }}
      controller={resizable}
      onLayoutChange={onLayoutChange}
    >
      <ResizablePanel
        className="docs-demo-frame"
        data-sized={width !== null || undefined}
        defaultSize={width === null ? 100 : `${width}px`}
        minSize={`${MIN_WIDTH}px`}
      >
        {children}
      </ResizablePanel>
      <ResizableHandle
        className="docs-demo-handle"
        aria-label="Resize preview"
        aria-valuetext={measured ? `${measured} pixels wide` : undefined}
        onDoubleClick={() => onResize(null)}
      />
      <ResizablePanel className="docs-demo-stage-rest" defaultSize={width === null ? 0 : undefined} />
      <span className="docs-demo-readout" aria-hidden="true">{measured ? `${measured}px` : ""}</span>
    </Resizable>
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

export const FILES_DEFAULT_WIDTH = 188
export const FILES_MIN_WIDTH = 140
/** The file list never takes more than this share of the viewer, so the source pane can't collapse. */
export const FILES_MAX_SHARE = 0.6

function CodeView({ src, files, height }: { src: string; files: DemoFile[]; height: string }) {
  const [active, setActive] = useState(files[0]?.path ?? "")
  useEffect(() => {
    if (!files.some((f) => f.path === active)) setActive(files[0]?.path ?? "")
  }, [files, active])
  const file = files.find((f) => f.path === active) ?? files[0]
  const rows = useMemo(() => fileTree(files), [files])
  const paths = files.map((f) => f.path)
  // The file list width is the user's choice; it lives in the resizable, so it survives file switches.
  const [resizable] = useState(() => createResizableController())

  return (
    <Tabs
      className="docs-demo-code-tabs"
      orientation="vertical"
      value={file?.path ?? null}
      onValueChange={(next) => {
        if (next) setActive(next)
      }}
    >
      <Resizable className="docs-demo-code" style={{ height }} controller={resizable}>
        <ResizablePanel
          className="docs-demo-files-pane"
          defaultSize={`${FILES_DEFAULT_WIDTH}px`}
          minSize={`${FILES_MIN_WIDTH}px`}
          maxSize={`${FILES_MAX_SHARE * 100}%`}
        >
          <TabsList className="docs-demo-files" aria-label="Files">
            <div className="docs-demo-files-h" aria-hidden="true">Files</div>
            {rows.map((row) =>
              row.kind === "dir" ? (
                <div key={`d:${row.path}`} className="docs-demo-dir" style={{ "--depth": row.depth } as CSSProperties} aria-hidden="true">
                  <Glyph name="folder" size={13} />
                  {row.name}
                </div>
              ) : (
                <TabsTab
                  key={row.path}
                  value={row.path}
                  title={row.path}
                  className="docs-demo-file"
                  style={{ "--depth": row.depth } as CSSProperties}
                >
                  <Glyph name="doc-code" size={13} />
                  <span>{row.name}</span>
                </TabsTab>
              ),
            )}
          </TabsList>
        </ResizablePanel>
        <ResizableHandle
          className="docs-demo-files-handle"
          aria-label="Resize file list"
          onDoubleClick={() => resizable.resize(0, `${FILES_DEFAULT_WIDTH}px`)}
        />
        <ResizablePanel className="docs-demo-source-pane">
          <div className="docs-demo-source">
            {/* The header stays mounted across files, so the breadcrumb keeps focus as it switches them. */}
            <div className="docs-demo-source-h">
              {file ? <PathBreadcrumb src={src} path={file.path} paths={paths} onSelect={setActive} /> : <span className="docs-demo-crumbs" />}
              {file ? <CopyButton text={file.content} label={`Copy ${file.path}`} /> : null}
            </div>
            {files.map((f) => (
              <TabsPanel key={f.path} value={f.path} className="docs-demo-source-body">
                <pre className="docs-code-numbered">
                  <HighlightedCode code={f.content.replace(/\n+$/, "")} language={f.language ?? languageForPath(f.path) ?? null} lineNumbers />
                </pre>
              </TabsPanel>
            ))}
            {file ? null : <Spinner label="Loading files" />}
          </div>
        </ResizablePanel>
      </Resizable>
    </Tabs>
  )
}

function FullscreenButton({ title }: { title: string }) {
  return (
    <DialogTrigger className="docs-demo-icon-btn" aria-label={`Open ${title} fullscreen`} title="Fullscreen">
      <Glyph name="arrows-expand" size={15} />
    </DialogTrigger>
  )
}

function NewTabLink({ href, title }: { href: string | undefined; title: string }) {
  if (!href) return null
  return (
    <a className="docs-demo-icon-btn" href={href} target="_blank" rel="noreferrer" aria-label={`Open ${title} in a new tab`} title="Open in new tab">
      <Glyph name="arrow-up-right-square" size={15} />
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

/** The full-viewport overlay: UI SDK's modal dialog (top layer, focus trap, Escape to close). It sits inside the
 *  `Dialog` root that wraps the viewer, so the header's fullscreen button is its trigger. */
function FullscreenDialog({ title, src, variants, variant, onVariant, preview, bleed, look, variantsWidth, href }: {
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
  return (
    <DialogContent className="docs-demo-dialog" initialFocus=".docs-demo-dialog-close">
      <div className="docs-demo-dialog-inner">
        <div className="docs-demo-dialog-bar">
          <DialogTitle render={<span />} className="docs-demo-title">{title}</DialogTitle>
          <span className="docs-demo-dialog-src">{src}</span>
          <span className="docs-demo-spacer" />
          <VariantSwitch variants={variants} value={variant} onChange={onVariant} title={title} width={variantsWidth} />
          <NewTabLink href={href} title={title} />
          <DialogClose className="docs-demo-icon-btn docs-demo-dialog-close" aria-label="Close fullscreen" title="Close (Esc)">
            <Glyph name="xmark" size={16} />
          </DialogClose>
        </div>
        <div className="docs-demo-dialog-stage">
          <DemoCanvas src={src} preview={preview} variant={variant} bleed={bleed} look={look} />
        </div>
      </div>
    </DialogContent>
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
  const vfs = useDemoVFSContext(props.vfs)
  // Pasted demos: files held by the VFS stand in for inline files the block doesn't carry.
  const vfsEntry = useDemoVFSEntry(vfs, props.files?.length ? "" : src)
  const ownFiles = props.files?.length ? props.files : vfsEntry?.files
  const ownEntry = props.files?.length ? props.entry : props.entry ?? vfsEntry?.meta?.entry
  const inlineFiles = useMemo(() => orderInline(ownFiles, ownEntry), [ownFiles, ownEntry])

  // A resolver is consulted unless the block brings its own files and the resolver
  // says (via `list()`) that it does not know this src.
  const tryResolver = !!resolver && !(inlineFiles && (!src || (resolver.list ? !resolver.list().includes(src) : false)))
  const hookResolver = tryResolver ? resolver : undefined
  const meta = useMeta(hookResolver, src)
  const resolvedFiles = useFiles(hookResolver, src, near)
  // Declared env variables the demo's sources use gate it: the module isn't even imported until they're loaded.
  const sourceTexts = useMemo(() => {
    const list = resolvedFiles.status === "ready" ? resolvedFiles.value : !tryResolver || resolvedFiles.status === "error" ? inlineFiles : null
    return list ? list.map((f) => f.content) : null
  }, [tryResolver, inlineFiles, resolvedFiles])
  const envGate = useEnvGate(sourceTexts)
  const component = useComponent(hookResolver, src, near && envGate.open)
  const resolverFailed = meta.status === "error" || resolvedFiles.status === "error" || component.status === "error"
  const mode: "resolver" | "inline" | "none" =
    tryResolver && !(inlineFiles && resolverFailed) ? "resolver" : inlineFiles ? "inline" : "none"

  const metaValue = mode === "resolver" ? (meta.status === "ready" ? meta.value : undefined) : mode === "inline" && !props.files?.length ? vfsEntry?.meta : undefined
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
  const href = mode === "resolver" ? resolver?.href?.(src, variant ? { variant } : undefined) : undefined
  const baseId = useId()

  const { runtime, dependencies } = runtimeOptions
  const envValues = envGate.values
  const envMissing = envGate.missing
  const preview: PreviewSource = useMemo(() => {
    if (mode === "inline" && props.streaming) return { kind: "streaming" }
    if (envMissing?.length) return { kind: "env", names: envMissing, title }
    if (mode !== "inline") return { kind: "component", component }
    if (!runtime || !inlineFiles) return { kind: "unavailable" }
    const entry = inlineFiles[0].path
    const env = Object.keys(envValues).length ? { env: envValues } : {}
    return { kind: "runtime", render: (v) => runtime({ src, title, files: inlineFiles, entry, variant: v, dependencies, ...env }) }
  }, [mode, component, props.streaming, runtime, inlineFiles, src, title, dependencies, envMissing, envValues])
  const runnable = preview.kind !== "unavailable"

  if (mode === "none") {
    return (
      <div className="docs-source-ref" data-docstream-demo="" data-demo-src={src}>
        <Glyph name="doc-code" size={16} />
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
  // "Copy demo": the exact block (src-only stays src-only; inline files stay inline) plus its files.
  const copyDemo = (): DocstreamClipboard | null => {
    if (!fileList?.length) return null
    const exact: DemoNode = props.files?.length ? { ...node, ...(props.entry ? { entry: props.entry } : {}), files: props.files.map((f) => ({ ...f })) } : node
    return createDocstreamClipboard({ type: "doc", children: [exact] }, { lookup: () => ({ files: fileList, ...(metaValue ? { meta: metaValue } : {}) }) })
  }

  const dialog = (
    <FullscreenDialog
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
      <Dialog>
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
            {fileList?.length ? <CopyDemoButton clipboard={copyDemo} className="docs-demo-icon-btn" /> : null}
            {runnable ? <FullscreenButton title={title} /> : null}
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
      </Dialog>
    )
  }

  return (
    <Dialog>
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
      copyDemo={fileList?.length ? copyDemo : undefined}
      dialog={dialog}
    />
    </Dialog>
  )
}

function MultiFileViewer({ rootRef, className, baseId, mode, src, title, description, variants, variant, onVariant, files, preview, near, height, viewport, bleed, look, status, variantsWidth, href, copyDemo, dialog }: {
  rootRef: Ref<HTMLElement>
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
  copyDemo: (() => DocstreamClipboard | null) | undefined
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
    <Tabs
      render={<section ref={rootRef} />}
      className={className}
      data-docstream-demo=""
      data-demo-src={src}
      data-demo-mode={mode}
      aria-labelledby={`${baseId}-title`}
      value={tab}
      onValueChange={(next) => {
        if (next === "preview" || next === "code") setTab(next)
      }}
    >
      <div className="docs-demo-head">
        <div className="docs-demo-heading">
          <div id={`${baseId}-title`} className="docs-demo-title">{title}</div>
          {description ? <p className="docs-demo-desc"><InlineMarkdown text={description} /></p> : null}
        </div>
        <div className="docs-demo-tools">
          <PillTabsList options={VIEW_TABS} label={`${title} view`} />
          <StatusBadge status={status} />
          <VariantSwitch variants={variants} value={variant} onChange={onVariant} title={title} width={variantsWidth} />
          {tab === "preview" && runnable ? (
            <ToggleGroup
              className="docs-demo-viewports"
              aria-label="Preview width"
              deselectable={false}
              value={activeViewport ? [activeViewport] : []}
              onValueChange={(next) => {
                const chosen = VIEWPORTS.find((v) => v.id === next[0])
                if (chosen) setWidth(chosen.width)
              }}
            >
              {VIEWPORTS.map(({ id, label, width: w, icon }) => (
                <Toggle key={id} value={id} className="docs-demo-vp" aria-label={w ? `${label} (${w}px)` : label} title={w ? `${label} · ${w}px` : label}>
                  <Glyph name={icon} size={15} />
                </Toggle>
              ))}
            </ToggleGroup>
          ) : null}
          {copyDemo ? <CopyDemoButton clipboard={copyDemo} className="docs-demo-icon-btn" /> : null}
          {runnable ? <FullscreenButton title={title} /> : null}
          <NewTabLink href={href} title={title} />
        </div>
      </div>
      <div className="docs-demo-body">
        {/* Both panels stay mounted, so the preview keeps its state while the code shows. */}
        <TabsPanel value="preview" keepMounted>
          {runnable ? (
            <PreviewStage width={width} onResize={setWidth} height={height}>
              {near ? <DemoCanvas src={src} preview={preview} variant={variant} bleed={bleed} look={look} /> : <Spinner />}
            </PreviewStage>
          ) : (
            <DemoCanvas src={src} preview={preview} variant={variant} />
          )}
        </TabsPanel>
        <TabsPanel value="code" keepMounted>
          {!runnable && tab === "code" ? <DemoCanvas src={src} preview={preview} variant={variant} /> : null}
          {codeSeen || tab === "code" ? (
            files.status === "ready" ? (
              <CodeView src={src} files={files.value} height={height} />
            ) : files.status === "error" ? (
              <DemoError message={`${src}: ${files.error.message}`} />
            ) : (
              <div className="docs-demo-code" style={{ height }}><Spinner label="Loading files" /></div>
            )
          ) : null}
        </TabsPanel>
      </div>
      {dialog}
    </Tabs>
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
      <DocstreamDemoContext.Provider value={resolver}>
        <DemoCanvas src={src} preview={{ kind: "component", component }} variant={chosen} bleed={metaValue?.bleed} look={metaValue} />
      </DocstreamDemoContext.Provider>
    </div>
  )
}
