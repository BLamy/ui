/* Every docstream and docstream-editor entry keeps its module graph to itself. Walk each entry's graph (static, type-only
   and dynamic imports alike, and through the library's own `@brett_lamy/ui/docstream…` imports into the entry they
   name) in the sources (`source` condition) and in the published build (`import` / `types`, dist/), which `npm test`
   builds first: hosts that don't install an optional peer (`@agent-wasm/core`, `@brett_lamy/viz-engine`, `xstate`) must
   be able to typecheck and bundle every entry but that peer's own, and the heavy parsers (Babel, acorn, rrweb, ELK, the
   Cloudflare catalog) load only when a page needs them. */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { describe, expect, it } from "vitest"

// docstream and its editor are part of @brett_lamy/ui, at `@brett_lamy/ui/docstream/*` and `@brett_lamy/ui/docstream-editor/*`.
// Entries are named here by their export key (`./docstream/xstate/machine`).
const root = resolve(__dirname, "../..")
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  exports: Record<string, ExportTarget>
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
  peerDependenciesMeta: Record<string, { optional?: boolean }>
}
const TREES = ["docstream", "docstream-editor"] as const
const treeOf = (name: string) => TREES.find((tree) => name === `./${tree}` || name.startsWith(`./${tree}/`))
const folded = Object.fromEntries(Object.entries(pkg.exports).filter(([name]) => treeOf(name)))
// The library's optional peers each come in through one entry of docstream's, and nowhere else.
const OPTIONAL_PEER_ENTRY: Record<string, string> = {
  "@brett_lamy/viz-engine": "./docstream/viz",
  "@agent-wasm/core": "./docstream/playground",
  xstate: "./docstream/xstate/machine",
}
// The entries that are for an optional peer: the rest must never reach it.
const PEER_ENTRIES = new Set(["./docstream/playground", "./docstream/viz"])

/* A script entry carries `source` (and the monorepo's `@org/source`, the same file) plus the built `import` and
   `types`; a stylesheet is the built file, with `@org/source` pointing workspace consumers at its source. */
type ExportTarget =
  | { "@org/source": string; source: string; import: string; types: string; default: string }
  | { "@org/source": string; default: string }
const isScript = (t: ExportTarget): t is Extract<ExportTarget, { source: string }> => "source" in t

const CSS_IMPORT = /@import\s+(?:url\()?["']([^"']+)["']/g
const IMPORT = /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g

function resolveFile(from: string, spec: string): string | null {
  const base = resolve(dirname(from), from.endsWith(".d.ts") ? spec.replace(/\.js$/, ".d.ts") : spec)
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, join(base, "index.ts"), join(base, "index.tsx")]) {
    if (existsSync(candidate) && !candidate.endsWith("/")) {
      try {
        readFileSync(candidate)
        return candidate
      } catch {
        // a directory
      }
    }
  }
  return null
}

/** The file a bare `@brett_lamy/ui/docstream…` import from `from` loads: the entry's source from a source file, its
    declarations from a `.d.ts`, its build from a built module. Null for anything else (a peer, `@brett_lamy/ui/cloudflare`). */
function resolveFolded(from: string, spec: string): string | null {
  if (!spec.startsWith("@brett_lamy/ui/")) return null
  const target = folded[`./${spec.slice("@brett_lamy/ui/".length)}`]
  if (!target) return null
  const inSource = relative(root, from).startsWith("src/")
  const file = !isScript(target) ? (inSource ? target["@org/source"] : target.default) : inSource ? target.source : from.endsWith(".d.ts") ? target.types : target.import
  return resolve(root, file)
}

function graph(entry: string, { dynamic = true } = {}): { files: string[]; bare: Set<string> } {
  const seen = new Set<string>()
  const bare = new Set<string>()
  const queue = [resolve(root, entry)]
  if (!existsSync(queue[0]!)) throw new Error(`${entry} is missing — build @brett_lamy/ui first`)
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(file.endsWith(".css") ? CSS_IMPORT : IMPORT)) {
      if (!dynamic && match[2]) continue
      const spec = match[1] ?? match[2] ?? match[3]
      // A root-relative path is no package: it's text that reads like an import (a workerd config's
      // `import "/workerd/workerd.capnp"`, in the editor's starter).
      if (!spec || spec.startsWith("/")) continue
      if (spec.startsWith(".")) {
        const next = resolveFile(file, spec)
        if (next) queue.push(next)
        continue
      }
      bare.add(spec)
      const next = resolveFolded(file, spec)
      if (next) queue.push(next)
    }
  }
  return { files: [...seen].map((f) => relative(root, f)), bare }
}

const entries = Object.entries(folded)
  .filter(([name]) => name !== "./docstream/playground")
  .flatMap(([name, target]): [string, string][] =>
    isScript(target) ? [[name, target.source], [name, target.import], [name, target.types]] : [[name, target.default], [name, target["@org/source"]]],
  )

describe("entry boundaries", () => {
  it("publishes every entry from dist/, with sources behind the `source` condition", () => {
    for (const [name, target] of Object.entries(folded)) {
      const tree = treeOf(name)!
      expect(target["@org/source"], name).toBe(isScript(target) ? target.source : target.default.replace("./dist/", "./src/"))
      if (!isScript(target)) {
        expect(target.default, name).toMatch(new RegExp(`^\\./dist/${tree}/.*\\.css$`))
        continue
      }
      expect(target.source, name).toMatch(new RegExp(`^\\./src/${tree}/.*\\.tsx?$`))
      expect(target.import, name).toBe(target.source.replace("./src/", "./dist/").replace(/\.tsx?$/, ".js"))
      expect(target.types, name).toBe(target.import.replace(/\.js$/, ".d.ts"))
    }
  })

  it.each(entries)("%s (%s) never references almost-node", (_name, target) => {
    const { files, bare } = graph(target)
    expect([...bare].filter((spec) => spec.startsWith("@agent-wasm/"))).toEqual([])
    expect(files.filter((f) => /^(src|dist)\/docstream\/playground\//.test(f) && !/^(src|dist)\/docstream\/playground\/project\.(ts|js|d\.ts)$/.test(f))).toEqual([])
  })

  it("keeps Babel and XState out of what every entry loads straight away, but the one that's for them", () => {
    for (const [name, target] of entries) {
      if (name === "./docstream/xstate/machine") continue
      expect([...graph(target, { dynamic: false }).bare].filter((spec) => spec === "@babel/parser" || spec === "xstate"), name).toEqual([])
    }
  })

  it("exports parseXState from its entry, in the published build", () => {
    const code = 'import("./dist/docstream/xstate/machine.js").then((m) => console.log(typeof m.parseXState, typeof m.xstateToMermaid, Object.keys(m.parseXState("{ initial: \'a\', states: { a: {} } }")).join()))'
    expect(execFileSync(process.execPath, ["--input-type=module", "-e", code], { cwd: root, encoding: "utf8" }).trim()).toBe("function function initial,states")
  })

  it("imports only declared dependencies (or optional peers from their own entry)", () => {
    const declared = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)])
    for (const [name, target] of entries) {
      for (const spec of graph(target).bare) {
        // The library itself, which docstream is part of.
        if (spec.startsWith("node:") || spec.startsWith("@brett_lamy/ui/")) continue
        const id = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!
        expect(declared.has(id), `${name} imports ${spec}`).toBe(true)
      }
      // An optional peer can be reached lazily, like the xstate fence's import of its machine, but only its own entry loads it straight away.
      for (const spec of graph(target, { dynamic: false }).bare) {
        const id = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!
        if (pkg.peerDependenciesMeta[id]?.optional && id !== "vite") {
          expect(name, `${name} imports optional peer ${id}`).toBe(OPTIONAL_PEER_ENTRY[id])
        }
      }
    }
  })

  // Plain Node (SSR, a host's vitest, the `/vite` plugin) loads dist/ without a bundler, so
  // every entry but the optional-peer ones must import there: fully specified relative
  // imports, no stylesheet imports on the eager path.
  it("loads every dist entry in plain Node (except the optional-peer entries)", () => {
    const specs = Object.entries(folded)
      .filter(([name, target]) => isScript(target) && !PEER_ENTRIES.has(name))
      .map(([name]) => `@brett_lamy/ui${name.slice(1)}`)
    const script = `for (const s of ${JSON.stringify(specs)}) await import(s)`
    expect(() => execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: root, stdio: "pipe" })).not.toThrow()
  })

  // The capnp fence draws with the library's Cloudflare entry, which brings the diagram and the catalog, about 150 KB: only
  // when there's one to draw. Nothing of docstream's reaches either another way.
  it.each(entries)("%s (%s) loads the library's Cloudflare diagram and catalog only through a dynamic import", (_name, target) => {
    expect([...graph(target, { dynamic: false }).bare].filter((spec) => /^@brett_lamy\/ui\/(cloudflare|cloudflare-diagram|lib\/cloudflare-)/.test(spec))).toEqual([])
  })

  // Every service the fence draws has its place (placeInLayers), so no docstream entry ever asks for a layout engine.
  it.each(entries)("%s (%s) never loads ELK", (_name, target) => {
    expect([...graph(target).bare].filter((spec) => spec === "elkjs" || spec.startsWith("elkjs/") || spec.includes("diagram-layout"))).toEqual([])
  })

  it.each(entries)("%s (%s) loads rrweb only through a dynamic import", (_name, target) => {
    expect([...graph(target, { dynamic: false }).bare].filter((spec) => spec === "rrweb" || spec.startsWith("rrweb/"))).toEqual([])
  })

  // The Strudel rack's parser (acorn) loads only when a reader opens the rack.
  it.each(entries.filter(([name]) => name !== "./docstream/strudel"))("%s (%s) loads acorn only through a dynamic import", (_name, target) => {
    expect([...graph(target, { dynamic: false }).bare].filter((spec) => spec === "acorn")).toEqual([])
  })

  // rrweb stays a regular dependency: the root ReplayPreview plays event sources, so an
  // optional peer would break every bundler that resolves the (lazy) import without it.
  it("keeps rrweb a dependency", () => {
    expect(pkg.dependencies.rrweb).toBeDefined()
    expect(pkg.peerDependencies.rrweb).toBeUndefined()
  })

  it("keeps almost-node an optional peer", () => {
    expect(pkg.peerDependenciesMeta["@agent-wasm/core"]?.optional).toBe(true)
    expect(pkg.dependencies["@agent-wasm/core"]).toBeUndefined()
  })
})
