/* A stand-in LivePreviewRenderer. The real one, almostNodeLiveRenderer from
   @brett_lamy/docstream/playground, runs the files as a Vite project (JSX, TypeScript, npm packages);
   it needs @agent-wasm/core, which this site doesn't install. This one evaluates plain JavaScript
   modules (h() is React.createElement; imports from "react" and relative files) and renders the
   entry's default export, enough to show the editor's loop: edit → debounce → preview. */
import * as React from "react"
import { Component, useMemo, type ReactNode } from "react"
import type { LivePreviewRenderer } from "@brett_lamy/docstream"

type Exports = Record<string, unknown>

function resolve(from: string, spec: string): string {
  const parts = from.split("/").slice(0, -1)
  for (const seg of spec.split("/")) {
    if (seg === "..") parts.pop()
    else if (seg !== ".") parts.push(seg)
  }
  return parts.join("/")
}

function run(files: Record<string, string>, path: string, seen: string[] = []): Exports {
  const code = files[path]
  if (code === undefined) throw new Error(`Cannot find ${path}`)
  if (seen.includes(path)) throw new Error(`Import cycle: ${[...seen, path].join(" → ")}`)
  const names: string[] = []
  const body =
    code
      .replace(/^\s*import\s+\{([^}]*)\}\s+from\s+["']([^"']+)["'];?/gm, (_, list: string, spec: string) => `const {${list.replace(/\bas\b/g, ":")}} = __import(${JSON.stringify(spec)});`)
      .replace(/^\s*import\s+(\w+)\s+from\s+["']([^"']+)["'];?/gm, (_, name: string, spec: string) => `const ${name} = __default(${JSON.stringify(spec)});`)
      .replace(/^(\s*)export\s+default\s+function\s+(\w+)/gm, (_, ws: string, name: string) => `${ws}exports.default = ${name};\n${ws}function ${name}`)
      .replace(/^(\s*)export\s+default\s+/gm, "$1exports.default = ")
      .replace(/^(\s*)export\s+(function|const|let)\s+(\w+)/gm, (_, ws: string, kw: string, name: string) => (names.push(name), `${ws}${kw} ${name}`)) +
    `\n${names.map((n) => `exports.${n} = ${n};`).join("\n")}`
  const load = (spec: string): Exports => (spec === "react" ? (React as unknown as Exports) : run(files, resolve(path, spec), [...seen, path]))
  const exports: Exports = {}
  new Function("exports", "__import", "__default", "h", body)(exports, load, (spec: string) => (spec === "react" ? React : load(spec).default), React.createElement)
  return exports
}

class Boundary extends Component<{ children: ReactNode; resetKey: unknown }, { error: Error | null; key: unknown }> {
  state = { error: null as Error | null, key: this.props.resetKey }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  static getDerivedStateFromProps(props: { resetKey: unknown }, state: { key: unknown }) {
    return props.resetKey === state.key ? null : { error: null, key: props.resetKey }
  }
  render() {
    return this.state.error ? <Failure message={this.state.error.message} /> : this.props.children
  }
}

const Failure = ({ message }: { message: string }) => <pre style={{ margin: 0, padding: 12, color: "#dc2626", whiteSpace: "pre-wrap", fontSize: 12 }}>{message}</pre>

function Preview({ files, entry }: { files: Record<string, string>; entry: string }) {
  const result = useMemo(() => {
    try {
      const App = run(files, entry).default
      return typeof App === "function" ? { App: App as React.ComponentType } : { error: `${entry} has no default-exported component` }
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : String(cause) }
    }
  }, [files, entry])
  if ("error" in result) return <Failure message={result.error ?? ""} />
  return (
    <Boundary resetKey={files}>
      <result.App />
    </Boundary>
  )
}

export const toyLiveRenderer: LivePreviewRenderer = ({ files, entry }) => <Preview files={files} entry={entry} />
