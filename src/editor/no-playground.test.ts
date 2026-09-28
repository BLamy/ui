/* The editor must install and bundle without Docstream's optional almost-node playground:
   no source file may import `@brett_lamy/docstream/playground` or `@agent-wasm/core`
   (hosts opt in by passing `liveRenderer` / `demoRuntime`). */
import { describe, expect, it } from "vitest"

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

  it("pins docstream to its own version", () => {
    expect(pkg.dependencies["@brett_lamy/docstream"]).toBe(pkg.version)
  })
})
