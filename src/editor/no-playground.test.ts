/* The editor must install and bundle without Docstream's optional almost-node playground:
   no source file may import `@brett_lamy/docstream/playground` or `@agent-wasm/core`
   (hosts opt in by passing `liveRenderer` / `demoRuntime`). */
// @ts-ignore node's types aren't installed; only these functions are needed.
import * as untypedFs from "node:fs"
// @ts-ignore
import * as untypedChildProcess from "node:child_process"
import { describe, expect, it } from "vitest"

const { existsSync, readdirSync, readFileSync, statSync } = untypedFs as {
  existsSync(path: string): boolean
  readdirSync(path: string): string[]
  readFileSync(path: string, encoding: "utf8"): string
  statSync(path: string): { isDirectory(): boolean }
}
const { execFileSync } = untypedChildProcess as {
  execFileSync(file: string, args: string[], options: { cwd: string; stdio: "pipe" }): unknown
}

// The published build (`npm test` runs `npm run build` first).
const root = new URL("../..", import.meta.url).pathname.replace(/\/$/, "")
const dist = `${root}/dist`
const join = (...parts: string[]) => parts.join("/").replace(/\/\.\//g, "/")
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

const sources = import.meta.glob<string>(["../**/*.{ts,tsx}", "!../**/*.test.{ts,tsx}"], {
  query: "?raw",
  import: "default",
  eager: true,
})
const pkg = Object.values(
  import.meta.glob<{ version: string; dependencies: Record<string, string> }>("../../package.json", {
    import: "default",
    eager: true,
  }),
)[0]!

describe("editor dependency boundary", () => {
  it("never imports the almost-node playground", () => {
    expect(Object.keys(sources).length).toBeGreaterThan(5)
    const offenders = Object.entries(sources)
      .filter(([, text]) => /["'](@brett_lamy\/docstream\/playground|@agent-wasm\/core)["']/.test(text))
      .map(([file]) => file)
    expect(offenders).toEqual([])
  })

  it("never imports the almost-node playground from dist/ either", () => {
    expect(existsSync(join(dist, "index.js")), "run `npm run build` first").toBe(true)
    const offenders = walk(dist)
      .filter((file) => /\.(js|d\.ts)$/.test(file))
      .filter((file) => /["'](@brett_lamy\/docstream\/playground|@agent-wasm\/core)["']/.test(readFileSync(file, "utf8")))
    expect(offenders).toEqual([])
  })

  it("publishes every entry from dist/ and loads each in plain Node", () => {
    const exports = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).exports as Record<
      string,
      string | { source: string; types: string; import: string }
    >
    const specs: string[] = []
    for (const [name, target] of Object.entries(exports)) {
      if (typeof target === "string") {
        expect(target, name).toMatch(/^\.\/dist\/.*\.css$/)
        expect(existsSync(join(root, target)), target).toBe(true)
        continue
      }
      expect(target.import, name).toBe(target.source.replace("./src/", "./dist/").replace(/\.tsx?$/, ".js"))
      expect(target.types, name).toBe(target.import.replace(/\.js$/, ".d.ts"))
      expect(existsSync(join(root, target.types)), target.types).toBe(true)
      specs.push(`@brett_lamy/docstream-editor${name.slice(1)}`)
    }
    const script = `for (const s of ${JSON.stringify(specs)}) await import(s)`
    expect(() => execFileSync("node", ["--input-type=module", "-e", script], { cwd: root, stdio: "pipe" })).not.toThrow()
  })

  it("pins docstream to its own version", () => {
    expect(pkg.dependencies["@brett_lamy/docstream"]).toBe(pkg.version)
  })
})
