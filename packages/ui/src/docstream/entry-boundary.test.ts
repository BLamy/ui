/* Hosts that don't install the optional `@agent-wasm/core` peer must be able to typecheck
   and bundle every entry except `/playground`. Walk each entry's module graph (static,
   type-only and dynamic imports alike) and make sure almost-node never shows up — in the
   sources (`source` condition) and in the published build (`import` / `types`, dist/),
   which `npm test` builds first. */
import { execFileSync } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { describe, expect, it } from "vitest"

// docstream is part of @brett_lamy/ui, at `@brett_lamy/ui/docstream/*`: these are the library's entries under ./docstream, named here
// as they were when it was a package of its own (`./xstate/machine` for `./docstream/xstate/machine`).
const root = resolve(__dirname, "../..")
const library = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  exports: Record<string, ExportTarget>
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
  peerDependenciesMeta: Record<string, { optional?: boolean }>
}
const pkg = {
  ...library,
  exports: Object.fromEntries(
    Object.entries(library.exports)
      .filter(([name]) => name === "./docstream" || name.startsWith("./docstream/"))
      .map(([name, target]) => [name === "./docstream" ? "." : `./${name.slice("./docstream/".length)}`, target]),
  ),
}
// The library's optional peers each come in through one entry of docstream's, and nowhere else.
const OPTIONAL_PEER_ENTRY: Record<string, string> = { "@brett_lamy/viz-engine": "./viz", "@agent-wasm/core": "./playground", xstate: "./xstate/machine" }

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
      if (!spec) continue
      if (spec.startsWith(".")) {
        const next = resolveFile(file, spec)
        if (next) queue.push(next)
      } else {
        bare.add(spec)
      }
    }
  }
  return { files: [...seen].map((f) => relative(root, f)), bare }
}

const entries = Object.entries(pkg.exports)
  .filter(([name]) => name !== "./playground")
  .flatMap(([name, target]): [string, string][] =>
    isScript(target) ? [[name, target.source], [name, target.import], [name, target.types]] : [[name, target.default], [name, target["@org/source"]]],
  )

describe("entry boundaries", () => {
  it("publishes every entry from dist/, with sources behind the `source` condition", () => {
    for (const [name, target] of Object.entries(pkg.exports)) {
      expect(target["@org/source"], name).toBe(isScript(target) ? target.source : target.default.replace("./dist/", "./src/"))
      if (!isScript(target)) {
        expect(target.default, name).toMatch(/^\.\/dist\/docstream\/.*\.css$/)
        continue
      }
      expect(target.source, name).toMatch(/^\.\/src\/docstream\/.*\.tsx?$/)
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
      if (name === "./xstate/machine") continue
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
    const specs = Object.entries(pkg.exports)
      .filter(([name, target]) => isScript(target) && name !== "./playground" && name !== "./viz")
      .map(([name]) => `@brett_lamy/ui/docstream${name.slice(1)}`)
    const script = `for (const s of ${JSON.stringify(specs)}) await import(s)`
    expect(() => execFileSync(process.execPath, ["--input-type=module", "-e", script], { cwd: root, stdio: "pipe" })).not.toThrow()
  })

  // The capnp fence draws with the library's Cloudflare entry, which brings the catalog, about 150 KB: only when there's one to draw.
  it.each(entries)("%s (%s) loads the library's Cloudflare entry only through a dynamic import", (_name, target) => {
    expect([...graph(target, { dynamic: false }).bare].filter((spec) => spec === "@brett_lamy/ui/cloudflare")).toEqual([])
  })

  it.each(entries)("%s (%s) loads rrweb only through a dynamic import", (_name, target) => {
    expect([...graph(target, { dynamic: false }).bare].filter((spec) => spec === "rrweb" || spec.startsWith("rrweb/"))).toEqual([])
  })

  // The Strudel rack's parser (acorn) loads only when a reader opens the rack.
  it.each(entries.filter(([name]) => name !== "./strudel"))("%s (%s) loads acorn only through a dynamic import", (_name, target) => {
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
