import type { DemoComponent, DemoFile, DemoMeta, DemoResolver } from "./types"

type Lazy<T> = () => Promise<T>
type MaybeLazy<T> = T | Lazy<T>

export interface GlobDemoResolverOptions {
  /**
   * Entry modules, e.g. `import.meta.glob("./examples/*\/*\/index.tsx")`.
   * Lazy (the default for `import.meta.glob`) or eager module objects both work.
   */
  modules: Record<string, MaybeLazy<unknown>>
  /**
   * Raw file contents, e.g.
   * `import.meta.glob("./examples/**\/*.{ts,tsx,css,json}", { query: "?raw", import: "default" })`.
   */
  sources: Record<string, MaybeLazy<string>>
  /**
   * Folder metadata, e.g.
   * `import.meta.glob("./examples/*\/*\/meta.json", { eager: true, import: "default" })`.
   */
  metas?: Record<string, MaybeLazy<DemoMeta | { default: DemoMeta }>>
  /**
   * The glob prefix the `<page>/<example>` ids are relative to, e.g. `"./examples"`.
   * When omitted, a demo's id is the last two folders of its entry path.
   */
  root?: string
  /** Default entry file name. Defaults to `index.tsx`; a folder's `meta.entry` wins. */
  entry?: string
  /** Hide files from the Code view (`meta.json` is always hidden). */
  exclude?: (path: string, src: string) => boolean
  /** Deep link for a demo alone, e.g. `(src) => demoHref(src)`. */
  href?: DemoResolver["href"]
}

const LANGUAGES: Record<string, string> = { mjs: "js", cjs: "js", mts: "ts", cts: "ts", md: "markdown", yml: "yaml" }

export function languageForPath(path: string): string | undefined {
  const ext = path.split("/").pop()?.split(".").pop()?.toLowerCase()
  if (!ext || ext === path) return undefined
  return LANGUAGES[ext] ?? ext
}

const unwrap = async <T,>(value: MaybeLazy<T>): Promise<T> =>
  typeof value === "function" ? (value as Lazy<T>)() : value

function trimSlashes(path: string) {
  return path.replace(/\\/g, "/").replace(/\/+$/, "")
}

/** Picks the component out of a loaded module: `default`, else the first function export. */
export function demoComponentFrom(module: unknown, src = "demo"): DemoComponent {
  if (typeof module === "function") return module as DemoComponent
  const record = (module ?? {}) as Record<string, unknown>
  const candidate =
    typeof record.default === "function"
      ? record.default
      : Object.values(record).find((value) => typeof value === "function")
  if (typeof candidate !== "function") throw new Error(`Demo ${src} has no default-exported component`)
  return candidate as DemoComponent
}

/** Orders files entry first, then top-level before nested, then by path. */
export function sortDemoFiles(files: DemoFile[], entry = "index.tsx"): DemoFile[] {
  const depth = (path: string) => path.split("/").length
  return [...files].sort((a, b) => {
    if (a.path === entry) return -1
    if (b.path === entry) return 1
    return depth(a.path) - depth(b.path) || a.path.localeCompare(b.path)
  })
}

/**
 * Build a `DemoResolver` from Vite `import.meta.glob` maps. Each `<page>/<example>`
 * folder holds an entry module (default export = the demo component, which receives
 * `variant`), any number of source files, and an optional `meta.json`.
 */
export function createGlobDemoResolver(options: GlobDemoResolverOptions): DemoResolver {
  const defaultEntry = options.entry ?? "index.tsx"
  const root = options.root === undefined ? undefined : trimSlashes(options.root)

  // Demo ids come from the entry modules: with `root`, the first two folders under it;
  // without, the last two folders of each entry path.
  const folders = new Map<string, string>() // src → folder prefix (with trailing slash)
  for (const key of Object.keys(options.modules)) {
    const path = key.replace(/\\/g, "/")
    if (root !== undefined) {
      const prefix = root ? `${root}/` : ""
      if (!path.startsWith(prefix)) continue
      const parts = path.slice(prefix.length).split("/")
      if (parts.length < 3) continue
      const src = `${parts[0]}/${parts[1]}`
      if (!folders.has(src)) folders.set(src, `${prefix}${src}/`)
    } else {
      const parts = path.split("/").slice(0, -1)
      if (parts.length < 2) continue
      const src = parts.slice(-2).join("/")
      if (!folders.has(src)) folders.set(src, `${parts.join("/")}/`)
    }
  }
  /** The key's path relative to the demo folder, or null when it lives elsewhere. */
  const inFolder = (src: string, key: string) => {
    const prefix = folders.get(src)
    const path = key.replace(/\\/g, "/")
    return prefix && path.startsWith(prefix) ? path.slice(prefix.length) : null
  }

  const metaCache = new Map<string, Promise<DemoMeta | undefined>>()
  const filesCache = new Map<string, Promise<DemoFile[]>>()
  const loadCache = new Map<string, Promise<DemoComponent>>()

  const meta = (src: string) => {
    let hit = metaCache.get(src)
    if (!hit) {
      const key = Object.keys(options.metas ?? {}).find((k) => inFolder(src, k) === "meta.json")
      hit = key
        ? unwrap(options.metas![key]).then((m) => {
            const value = m as DemoMeta & { default?: DemoMeta }
            return value && typeof value === "object" && "default" in value && value.default ? value.default : value
          })
        : Promise.resolve(undefined)
      metaCache.set(src, hit)
    }
    return hit
  }

  const entryFor = async (src: string) => (await meta(src))?.entry ?? defaultEntry

  return {
    list: () => [...folders.keys()].sort(),
    meta,
    files(src) {
      let hit = filesCache.get(src)
      if (!hit) {
        hit = (async () => {
          const entry = await entryFor(src)
          const found = Object.entries(options.sources)
            .map(([key, value]) => ({ path: inFolder(src, key), value }))
            .filter((f): f is { path: string; value: MaybeLazy<string> } =>
              !!f.path && f.path !== "meta.json" && !options.exclude?.(f.path, src))
          const files = await Promise.all(found.map(async ({ path, value }) => {
            const content = await unwrap(value)
            return { path, content: typeof content === "string" ? content : String(content), language: languageForPath(path) }
          }))
          return sortDemoFiles(files, entry)
        })()
        filesCache.set(src, hit)
      }
      return hit
    },
    load(src) {
      let hit = loadCache.get(src)
      if (!hit) {
        hit = (async () => {
          const entry = await entryFor(src)
          const keys = Object.keys(options.modules).filter((k) => inFolder(src, k) !== null)
          const key = keys.find((k) => inFolder(src, k) === entry) ?? keys[0]
          if (!key) throw new Error(`No demo module found for ${src}`)
          return demoComponentFrom(await unwrap(options.modules[key]), src)
        })()
        hit.catch(() => loadCache.delete(src))
        loadCache.set(src, hit)
      }
      return hit
    },
    ...(options.href ? { href: options.href } : {}),
  }
}

/**
 * The conventional deep link for one demo: `?demo=<src>` on the current page
 * (or `base`). Hosts route it to `<DemoFullscreen>`; see `demoFromSearch`.
 */
export function demoHref(src: string, options: { base?: string; variant?: string; param?: string } = {}): string {
  const base = options.base ?? (typeof location === "undefined" ? "/" : location.pathname)
  const params = new URLSearchParams({ [options.param ?? "demo"]: src })
  if (options.variant) params.set("variant", options.variant)
  return `${base}?${params.toString().replace(/%2F/gi, "/")}`
}

/** Reads the `?demo=<src>` (and optional `variant`) deep link. */
export function demoFromSearch(search?: string, param = "demo"): { src: string; variant?: string } | null {
  const query = search ?? (typeof location === "undefined" ? "" : location.search)
  const params = new URLSearchParams(query)
  const src = params.get(param)
  if (!src) return null
  const variant = params.get("variant")
  return variant ? { src, variant } : { src }
}
