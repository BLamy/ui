import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const styles = readFileSync(new URL("../styles.css", import.meta.url), "utf8")

describe("DocStream markdown defaults", () => {
  it("styles headings through both public render roots", () => {
    expect(styles).toContain(":is([data-docstream], .docs-article) h1")
    for (const level of ["h1", "h2", "h3", "h4", "h5", "h6"]) {
      expect(styles).toContain(`) ${level} {`)
    }
  })

  it("sets rhythm on every DocStream block group", () => {
    expect(styles).toContain("[data-docstream-blocks] > * + *")
    expect(styles).toContain("[data-docstream-blocks] > :is(h1, h2, h3, h4, h5, h6)")
  })

  it("keeps table and card table blocks flush even after a sibling block", () => {
    const tableRule = styles.match(
      /:is\(\[data-docstream\], \.docs-article\) \[data-docstream-blocks\] > :is\(\.docs-table, \.docs-cards\)\s*\{([^}]+)\}/
    )

    expect(tableRule?.[1]).toContain("margin-block-start: 0;")
    expect(tableRule?.[1]).toContain("margin-block-end: 0;")
  })
})
