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

/** Selector specificity [ids, classes/attributes/pseudo-classes, types] for the forms styles.css uses. */
function specificity(selector: string): [number, number, number] {
  let s = selector.trim()
  const total: [number, number, number] = [0, 0, 0]
  const add = (x: [number, number, number]) => x.forEach((v, i) => (total[i] += v))
  const greater = (a: [number, number, number], b: [number, number, number]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
  // :is()/:not()/:has() count their most specific argument; :where() counts nothing.
  for (;;) {
    const m = s.match(/:(is|where|not|has)\(/)
    if (!m || m.index === undefined) break
    let depth = 0
    let end = m.index + m[0].length - 1
    for (; end < s.length; end++) {
      if (s[end] === "(") depth++
      else if (s[end] === ")" && --depth === 0) break
    }
    const inner = s.slice(m.index + m[0].length, end)
    if (m[1] !== "where") {
      const parts = inner.split(",").map(specificity)
      add(parts.reduce((a, b) => (greater(a, b) >= 0 ? a : b)))
    }
    s = s.slice(0, m.index) + " " + s.slice(end + 1)
  }
  total[0] += (s.match(/#[\w-]+/g) ?? []).length
  total[1] += (s.match(/\.[\w-]+|\[[^\]]+\]|:(?!:)[\w-]+/g) ?? []).length
  total[2] += (s.replace(/\[[^\]]+\]/g, "").match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length
  return total
}

const outranks = (a: string, b: string) => {
  const x = specificity(a)
  const y = specificity(b)
  return (x[0] - y[0] || x[1] - y[1] || x[2] - y[2]) > 0
}

function rule(selector: string): string {
  const at = styles.indexOf(`${selector} {`)
  expect(at, selector).toBeGreaterThanOrEqual(0)
  return styles.slice(at, styles.indexOf("}", at))
}

describe("titled tab sections space themselves without host CSS", () => {
  const generic = [
    ":is([data-docstream], .docs-article) [data-docstream-blocks] > *",
    ":is([data-docstream], .docs-article) [data-docstream-blocks] > :is(.docs-cards, .docs-code, .docs-math)",
    ":is([data-docstream], .docs-article) [data-docstream-blocks] > :is(h1, h2, h3, h4, h5, h6)",
    ":is([data-docstream], .docs-article) [data-docstream-blocks] > .docs-demo",
    ":is([data-docstream], .docs-article) [data-docstream-blocks] > :is(.docs-table, table, .docs-cards)",
  ]
  const body = ":is([data-docstream], .docs-article) .docs-tabs-section > .docs-tabs-section-body > [data-docstream-blocks] > *"

  it("the section body's rhythm outranks every generic block-spacing rule", () => {
    expect(rule(body)).toContain("margin-block: 0 10px;")
    expect(rule(`${body.slice(0, -1)}:last-child`)).toContain("margin-bottom: 0;")
    for (const g of generic) expect(outranks(body, g), g).toBe(true)
    expect(specificity(":is([data-docstream], .docs-article) [data-docstream-blocks] > :is(.docs-cards, .docs-code)")).toEqual([0, 3, 0])
  })

  it("the heading drops page-heading margins/padding so it centres on the switch row", () => {
    const title = ":is([data-docstream], .docs-article) .docs-tabs-section > .docs-tabs-section-head > .docs-tabs-section-title"
    const css = rule(title)
    expect(css).toContain("margin: 0;")
    expect(css).toContain("padding-block: 0;")
    expect(css).toContain("align-self: center;")
    expect(rule(".docs-tabs-section-head")).toContain("align-items: center;")
    // Outranks docstream's own heading rules and a typical host `.prose .content h2`.
    for (const g of [":is([data-docstream], .docs-article) :is(h1, h2, h3, h4, h5, h6)", ".dk-doc .wb-md h2", ".dk-doc .wb-md .docs-tabs-section-title"]) {
      expect(outranks(title, g), g).toBe(true)
    }
  })
})

describe("demo canvas and single-file preview sizing", () => {
  it("the canvas is block flow, so `max-width; margin: 0 auto` roots keep their width", () => {
    const canvas = rule(".docs-demo-canvas")
    expect(canvas).toContain("display: block;")
    expect(canvas).not.toMatch(/display: (grid|flex)/)
    expect(canvas).not.toContain("place-items")
    // Intrinsically sized (inline-level) roots are centred by the line box; children reset it with zero specificity.
    expect(canvas).toContain("text-align: center;")
    expect(rule(":where(.docs-demo-canvas) > *")).toContain("text-align: start;")
    expect(specificity(":where(.docs-demo-canvas) > *")).toEqual([0, 0, 0])
  })

  it("single-file previews size to content unless a host sets a floor", () => {
    const preview = rule(".docs-demo-single-preview")
    expect(preview).toContain("min-height: var(--docs-demo-preview-min-height, 0px);")
    expect(preview).not.toContain("120px")
  })
})
