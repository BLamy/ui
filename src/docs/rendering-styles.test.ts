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

  it("keeps standard and card tables flush after the block spacing rules", () => {
    const selector = ":is([data-docstream], .docs-article) [data-docstream-blocks] > :is(.docs-table, table, .docs-cards)"
    const tableRule = styles.match(
      /:is\(\[data-docstream\], \.docs-article\) \[data-docstream-blocks\] > :is\(\.docs-table, table, \.docs-cards\)\s*\{([^}]+)\}/
    )

    expect(tableRule).not.toBeNull()
    expect(tableRule?.[1]).toContain("margin-block-start: 0;")
    expect(tableRule?.[1]).toContain("margin-block-end: 0;")
    expect(tableRule?.index).toBeGreaterThan(styles.indexOf("> :is(.docs-cards, .docs-code"))
    expect(styles.trimEnd().slice(tableRule?.index)).toContain(`${selector} {`)
    expect((tableRule?.index ?? -1) + (tableRule?.[0].length ?? 0)).toBe(styles.trimEnd().length)
  })
})
