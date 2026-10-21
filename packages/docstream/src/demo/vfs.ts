/* The demo virtual file system: demo files held in memory by `src`, for demos no host
   resolver knows — typically ones pasted from another docstream page or editor.

   - `DemoViewer` reads it from context (`DocstreamDemoVFSContext`, or a renderer's `demoVFS`):
     a block with no inline files whose `src` is in the VFS shows the VFS files exactly like
     inline files (the host resolver still wins when it knows `src`; the Preview runs through
     the `demoRuntime`, else the Code view opens with the "needs runtime" note).
   - `vfs.resolver({ resolver, runtime })` is the same thing as a `DemoResolver`, layered over
     a host resolver: `files` / `meta` from the host when it knows `src`, else from the VFS;
     `load` from the host, else a component that runs the VFS files through the runtime.
   - One VFS may be shared by several editors / renderers; `subscribe` reports changes so a
     host can persist pasted files. */
import { useContext, useRef, useSyncExternalStore } from "react"
import { DocstreamDemoVFSContext } from "./context"
import type { DemoComponentProps, DemoFile, DemoMeta, DemoResolver, InlineDemoRuntime } from "./types"

export interface DemoVFSEntry {
  /** Entry first (or `meta.entry`), paths relative to the demo folder. */
  files: DemoFile[]
  /** `meta.json`-style defaults, usually the `{% demo %}` tag's attributes. */
  meta?: DemoMeta
}

export interface DemoVFSChange {
  src: string
  /** The new entry; `undefined` when `src` was removed. */
  entry: DemoVFSEntry | undefined
}

export interface DemoVFSResolverOptions {
  /** The host resolver, consulted first. */
  resolver?: DemoResolver
  /** Runs VFS files for `load(src)`. Without one, `load` rejects for VFS-only demos. */
  runtime?: InlineDemoRuntime
  /** Extra npm dependencies handed to the runtime. */
  dependencies?: Record<string, string>
}

export interface DemoVFS {
  get(src: string): DemoVFSEntry | undefined
  has(src: string): boolean
  /** Every `src` held, in insertion order. */
  list(): string[]
  /** Adds or replaces `src`. A no-op (and no change event) when nothing differs. */
  set(src: string, files: DemoFile[], meta?: DemoMeta): void
  delete(src: string): boolean
  clear(): void
  /** Everything held, as `{ [src]: entry }`. The object is stable until the next change. */
  snapshot(): Readonly<Record<string, DemoVFSEntry>>
  /** Files only, as `{ [src]: files }` (what a host usually persists). Stable until the next change. */
  files(): Readonly<Record<string, DemoFile[]>>
  subscribe(listener: (change: DemoVFSChange) => void): () => void
  /** This VFS as a `DemoResolver` layered over a host resolver. */
  resolver(options?: DemoVFSResolverOptions): DemoResolver
}

const RUNTIME_NOTE = "Live preview needs the playground runtime. The code is shown instead."

function cleanFiles(files: DemoFile[]): DemoFile[] {
  return files
    .filter((f) => f && typeof f.path === "string" && typeof f.content === "string")
    .map((f) => ({ path: f.path, content: f.content, ...(f.language ? { language: f.language } : {}) }))
}

function entryFirst(files: DemoFile[], entry: string | undefined): DemoFile[] {
  const index = entry ? files.findIndex((f) => f.path === entry) : -1
  return index > 0 ? [files[index], ...files.slice(0, index), ...files.slice(index + 1)] : files
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** A new, empty (or pre-filled) demo VFS. */
export function createDemoVFS(initial?: Record<string, DemoFile[] | DemoVFSEntry>): DemoVFS {
  const entries = new Map<string, DemoVFSEntry>()
  const listeners = new Set<(change: DemoVFSChange) => void>()
  let snap: Record<string, DemoVFSEntry> | null = null
  let fileSnap: Record<string, DemoFile[]> | null = null

  const put = (src: string, files: DemoFile[], meta?: DemoMeta) => {
    const entry: DemoVFSEntry = { files: cleanFiles(files), ...(meta && Object.keys(meta).length ? { meta } : {}) }
    const prev = entries.get(src)
    if (prev && same(prev, entry)) return undefined
    entries.set(src, entry)
    return entry
  }
  const emit = (change: DemoVFSChange) => {
    snap = null
    fileSnap = null
    for (const listener of Array.from(listeners)) listener(change)
  }

  for (const [src, value] of Object.entries(initial ?? {})) {
    if (Array.isArray(value)) put(src, value)
    else if (value) put(src, value.files, value.meta)
  }

  const vfs: DemoVFS = {
    get: (src) => entries.get(src),
    has: (src) => entries.has(src),
    list: () => Array.from(entries.keys()),
    set(src, files, meta) {
      const entry = put(src, files, meta)
      if (entry) emit({ src, entry })
    },
    delete(src) {
      if (!entries.delete(src)) return false
      emit({ src, entry: undefined })
      return true
    },
    clear() {
      for (const src of Array.from(entries.keys())) vfs.delete(src)
    },
    snapshot() {
      if (!snap) snap = Object.fromEntries(entries)
      return snap
    },
    files() {
      if (!fileSnap) fileSnap = Object.fromEntries(Array.from(entries, ([src, e]) => [src, e.files]))
      return fileSnap
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    resolver: (options) => layeredResolver(vfs, options ?? {}),
  }
  return vfs
}

function layeredResolver(vfs: DemoVFS, { resolver: host, runtime, dependencies }: DemoVFSResolverOptions): DemoResolver {
  // Whether the host should be asked first: it lists `src`, or it can't list at all.
  const hostFirst = (src: string) => !!host && (!host.list || host.list().includes(src) || !vfs.has(src))
  const fromVfs = (src: string) => {
    const entry = vfs.get(src)
    if (!entry) throw new Error(`Unknown demo: ${src}`)
    return entry
  }
  async function pick<T>(src: string, viaHost: (host: DemoResolver) => Promise<T>, viaVfs: (entry: DemoVFSEntry) => T): Promise<T> {
    if (hostFirst(src)) {
      try {
        return await viaHost(host!)
      } catch (error) {
        if (!vfs.has(src)) throw error
      }
    }
    return viaVfs(fromVfs(src))
  }
  const layered: DemoResolver = {
    list: () => Array.from(new Set([...(host?.list?.() ?? []), ...vfs.list()])),
    meta: (src) => pick(src, (h) => h.meta(src), (e) => e.meta),
    files: (src) => pick(src, (h) => h.files(src), (e) => entryFirst(e.files, e.meta?.entry)),
    load: (src) =>
      pick(src, (h) => h.load(src), (e) => {
        if (!runtime) throw new Error(RUNTIME_NOTE)
        const files = entryFirst(e.files, e.meta?.entry)
        const title = e.meta?.title ?? (src.split("/").pop() || "Demo")
        const VfsDemo = ({ variant }: DemoComponentProps) =>
          runtime({ src, title, files, entry: files[0]?.path ?? "index.tsx", ...(variant ? { variant } : {}), ...(dependencies ? { dependencies } : {}) })
        VfsDemo.displayName = `VfsDemo(${src})`
        return VfsDemo as never
      }),
  }
  if (host?.href) layered.href = (src, options) => (hostFirst(src) ? host.href!(src, options) : undefined)
  return layered
}

/**
 * A demo VFS owned by the calling component (created once). Pass it as `demoVFS` to several
 * editors / renderers to share pasted demo files between them.
 */
export function useDemoVFS(initial?: Record<string, DemoFile[] | DemoVFSEntry>): DemoVFS {
  const ref = useRef<DemoVFS | null>(null)
  if (!ref.current) ref.current = createDemoVFS(initial)
  return ref.current
}

/** The VFS in context (a renderer's or editor's `demoVFS`), unless `override` is given. */
export function useDemoVFSContext(override?: DemoVFS): DemoVFS | undefined {
  const inherited = useContext(DocstreamDemoVFSContext)
  return override ?? inherited
}

const EMPTY: Readonly<Record<string, DemoFile[]>> = Object.freeze({})
const noop = () => () => {}

/** `{ [src]: files }` of a VFS, re-rendering on change. */
export function useDemoVFSFiles(vfs: DemoVFS | undefined): Readonly<Record<string, DemoFile[]>> {
  return useSyncExternalStore(vfs ? vfs.subscribe : noop, () => (vfs ? vfs.files() : EMPTY), () => (vfs ? vfs.files() : EMPTY))
}

/** One VFS entry, re-rendering when it changes. */
export function useDemoVFSEntry(vfs: DemoVFS | undefined, src: string): DemoVFSEntry | undefined {
  const snapshot = useSyncExternalStore(vfs ? vfs.subscribe : noop, () => vfs?.snapshot(), () => vfs?.snapshot())
  return src ? snapshot?.[src] : undefined
}
