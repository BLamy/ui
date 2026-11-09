/* A SourceReferenceClient over files held in memory, standing in for docstream's Vite plugin
   (createViteSourceClient) or your own backend. read and write are a Map; importModule evaluates
   the file. To stay small it runs plain JavaScript only (no JSX, no TypeScript): components call
   `h(type, props, ...children)` (React.createElement) and may import from "react" and from other
   files in the map. A real host compiles the file instead, e.g. through Vite. */
import * as React from "react"
import type { SourceFileSnapshot, SourceModule, SourceReferenceClient } from "@brett_lamy/docstream/source"
import type { SourceRefNode } from "@brett_lamy/docstream/gitbook"

type Exports = Record<string, unknown>

function evaluate(code: string, path: string, load: (path: string) => Exports): Exports {
  const names: string[] = []
  let body = code
    .replace(/^\s*import\s+\{([^}]*)\}\s+from\s+["']([^"']+)["'];?/gm, (_, list: string, from: string) => `const {${list.replace(/\bas\b/g, ":")}} = __import(${JSON.stringify(from)});`)
    .replace(/^\s*import\s+(?:\*\s+as\s+)?(\w+)\s+from\s+["']([^"']+)["'];?/gm, (_, name: string, from: string) =>
      from === "react" ? `const ${name} = __import("react");` : `const ${name} = __import(${JSON.stringify(from)}).default;`,
    )
    .replace(/^(\s*)export\s+default\s+function\s+(\w+)/gm, (_, ws: string, name: string) => `${ws}exports.default = ${name};\n${ws}function ${name}`)
    .replace(/^(\s*)export\s+default\s+/gm, "$1exports.default = ")
    .replace(/^(\s*)export\s+(function|const|let)\s+(\w+)/gm, (_, ws: string, kw: string, name: string) => {
      names.push(name)
      return `${ws}${kw} ${name}`
    })
  body += `\n${names.map((n) => `exports.${n} = ${n};`).join("\n")}`
  if (/^\s*(import|export)\s/m.test(body)) throw new Error(`${path}: this in-memory client only understands simple import / export lines`)
  const exports: Exports = {}
  const importer = (from: string) => (from === "react" ? React : load(from))
  try {
    new Function("exports", "__import", "h", body)(exports, importer, React.createElement)
  } catch (cause) {
    throw new Error(`${path}: ${cause instanceof Error ? cause.message : String(cause)}`)
  }
  return exports
}

export interface MemorySourceClient extends SourceReferenceClient {
  files: Map<string, string>
}

export function createMemorySourceClient(seed: Record<string, string>, onChange?: () => void): MemorySourceClient {
  const files = new Map(Object.entries(seed))
  const mtimes = new Map<string, number>()
  const snapshot = (reference: SourceRefNode, content: string): SourceFileSnapshot => ({
    content,
    provenance: { mount: reference.mount, path: reference.path, exportName: reference.exportName, kind: reference.kind, mtimeMs: mtimes.get(reference.path) ?? 0 },
  })
  const load = (path: string, seen: Set<string>): Exports => {
    const key = path.replace(/^\.\//, "src/")
    const code = files.get(key)
    if (code === undefined) throw new Error(`Cannot find ${path}`)
    if (seen.has(key)) throw new Error(`Import cycle at ${key}`)
    return evaluate(code, key, (next) => load(next, new Set([...seen, key])))
  }
  return {
    files,
    async read(reference) {
      await new Promise((r) => setTimeout(r, 120))
      const content = files.get(reference.path)
      if (content === undefined) throw new Error(`${reference.mount}:${reference.path} does not exist`)
      return snapshot(reference, content)
    },
    async write(reference, content) {
      await new Promise((r) => setTimeout(r, 200))
      files.set(reference.path, content)
      mtimes.set(reference.path, Date.now())
      onChange?.()
      return snapshot(reference, content)
    },
    async importModule(reference) {
      return load(reference.path, new Set()) as SourceModule
    },
  }
}
