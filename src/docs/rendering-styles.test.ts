import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

describe("DocStream markdown defaults", () => {
  it("styles headings through both public render roots", () => {
    expect(styles).toContain(":is([data-docstream], .docs-article) h1")
    expect(styles).toContain("font-size: 2.2em;")
    expect(styles).toContain("font-weight: 700;")
    expect(styles).toContain("line-height: 1.25;")
    for (const level of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      expect(styles).toContain(`) ${level} {`)
    }
  })

  it("sets predefined spacing on rendered markdown blocks", () => {
    expect(styles).toContain("[data-docstream-blocks] > * {\n  margin-block: 0.75em;")
    expect(styles).toContain("> :is(.docs-cards, .docs-code, .docs-math, .docs-hint")
    expect(styles).toContain("[data-docstream-blocks] > :is(h1, h2, h3, h4, h5, h6) {\n  margin-block: 1.6em 0.45em;")
  })

  it("keeps tables flush with exactly zero vertical margin", () => {
    const tableRule = styles.match(
      /:is\(\[data-docstream\], \.docs-article\) \[data-docstream-blocks\] > :is\(\.docs-table, table\)\s*\{([^}]+)\}/
    )

    expect(tableRule?.[1]).toContain("margin-block: 0;")
  })
})
