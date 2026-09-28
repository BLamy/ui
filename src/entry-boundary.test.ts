/* Hosts that don't install the optional `@agent-wasm/core` peer must be able to typecheck
   and bundle every entry except `/playground`. Walk each entry's module graph (static,
   type-only and dynamic imports alike) and make sure almost-node never shows up. */
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { describe, expect, it } from "vitest"

const root = resolve(__dirname, "..")
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
  exports: Record<string, string | { import: string }>
  dependencies: Record<string, string>
  peerDependencies: Record<string, string>
  peerDependenciesMeta: Record<string, { optional?: boolean }>
}

const CSS_IMPORT = /@import\s+(?:url\()?["']([^"']+)["']/g
const IMPORT = /(?:import|export)\s[^'"]*?from\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)|import\s+["']([^"']+)["']/g

function resolveFile(from: string, spec: string): string | null {
  const base = resolve(dirname(from), spec)
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

function graph(entry: string): { files: string[]; bare: Set<string> } {
  const seen = new Set<string>()
  const bare = new Set<string>()
  const queue = [resolve(root, entry)]
  while (queue.length) {
    const file = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const source = readFileSync(file, "utf8")
    for (const match of source.matchAll(file.endsWith(".css") ? CSS_IMPORT : IMPORT)) {
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
  .map(([name, target]): [string, { import: string }] => [name, typeof target === "string" ? { import: target } : target])
  .filter(([name]) => name !== "./playground")

describe("entry boundaries", () => {
  it.each(entries)("%s never references almost-node", (_name, target) => {
    const { files, bare } = graph(target.import)
    expect([...bare].filter((spec) => spec.startsWith("@agent-wasm/"))).toEqual([])
    expect(files.filter((f) => f.startsWith("src/playground/") && f !== "src/playground/project.ts")).toEqual([])
  })

  it("imports only declared dependencies (or optional peers from their own entry)", () => {
    const declared = new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)])
    for (const [name, target] of entries) {
      for (const spec of graph(target.import).bare) {
        if (spec.startsWith("node:")) continue
        const id = spec.startsWith("@") ? spec.split("/").slice(0, 2).join("/") : spec.split("/")[0]!
        expect(declared.has(id), `${name} imports ${spec}`).toBe(true)
        if (pkg.peerDependenciesMeta[id]?.optional && id !== "vite") {
          expect(name, `${name} imports optional peer ${id}`).toBe(`./${id === "@brett_lamy/viz-engine" ? "viz" : id}`)
        }
      }
    }
  })

  it("keeps almost-node an optional peer", () => {
    expect(pkg.peerDependenciesMeta["@agent-wasm/core"]?.optional).toBe(true)
    expect(pkg.dependencies["@agent-wasm/core"]).toBeUndefined()
  })
})
