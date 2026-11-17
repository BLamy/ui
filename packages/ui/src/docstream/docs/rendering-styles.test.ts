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
    expect(styles).toContain("> :is(.docs-cards, .docs-code, .docs-split-card, .docs-hint")
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

describe("TuiPreview and StlViewer chrome take the page's tokens", () => {
  const block = (selector: string) => {
    const at = styles.indexOf(`${selector} {`)
    expect(at, selector).toBeGreaterThanOrEqual(0)
    return styles.slice(at, styles.indexOf("}", at))
  }
  const coarse = (() => {
    const at = styles.indexOf("@media (pointer: coarse) {\n  .docstream-tui__button")
    expect(at).toBeGreaterThanOrEqual(0)
    return styles.slice(at, styles.indexOf("\n}\n", at))
  })()

  it("the TUI's buttons and source toggle are styled, with a visible focus ring", () => {
    const button = block(".docstream-tui__button")
    expect(button).toContain("appearance: none;")
    expect(button).toContain("border: 1px solid var(--docstream-tui-line);")
    // The Run button's fill is the primary deepened until its label reads at 4.5:1 (white on a system blue is ~3.6:1).
    expect(block('.docstream-tui__button[data-variant="primary"]')).toContain("background: var(--docstream-tui-primary-fill);")
    expect(block(".docstream-tui")).toContain("--docstream-tui-primary-fill: color-mix(in oklab, var(--docstream-tui-primary) 82%, black);")
    expect(block(".docstream-tui__button:focus-visible,\n.docstream-tui__source-trigger:focus-visible")).toContain("outline: 2px solid var(--docstream-tui-ring);")
    expect(block(".docstream-tui__source-trigger::-webkit-details-marker")).toContain("display: none;")
  })

  it("every token falls back to the host's shadcn names outside a docstream article, and 2.0.0's border hook still works", () => {
    const root = block(".docstream-tui")
    expect(root).toContain("--docstream-tui-line: var(--docstream-tui-border, var(--gb-border, var(--border,")
    expect(root).toContain("--docstream-tui-panel: var(--gb-panel, var(--card, Canvas));")
    expect(root).toContain("--docstream-tui-ring: var(--ring,")
    expect(root).toContain("--docstream-tui-mono: var(--font-mono, ui-monospace,")
  })

  it("the placeholder screen and the source use the mono stack", () => {
    expect(block(".docstream-tui__placeholder")).toContain("font-family: var(--docstream-tui-mono);")
    expect(block(".docstream-tui__code")).toContain("font-family: var(--docstream-tui-mono);")
  })

  it("touch layouts get 44px targets", () => {
    expect(coarse).toMatch(/\.docstream-tui__button \{[^}]*height: 44px;/)
    expect(coarse).toMatch(/\.docstream-tui__source-trigger \{[^}]*min-height: 44px;/)
    // The Reset pill keeps its look: an invisible target 11px above and below its ~23px reaches 44px.
    expect(coarse).toMatch(/\.docstream-stl__reset::after \{[^}]*inset: -11px -4px;/)
    expect(coarse).not.toMatch(/\.docstream-stl__reset \{[^}]*min-height/)
  })

  it("the Strudel code panel uses the mono stack, not the browser's Courier", () => {
    expect(block(".docstream-strudel__code")).toContain('font-family: var(--font-mono, "SF Mono", ui-monospace, Menlo, monospace);')
  })

  it("the STL Reset pill takes the card pair, not a white fallback, outside an article", () => {
    const reset = block(".docstream-stl__reset")
    expect(reset).toContain("background: var(--gb-panel, var(--card, Canvas));")
    expect(reset).toContain("color: var(--gb-panel-foreground, var(--card-foreground, CanvasText));")
    expect(block(".docstream-stl__reset:focus-visible")).toContain("outline: 2px solid")
  })
})

describe("2.0.1 touch targets, focus ring and the replay play disc", () => {
  const coarse = (() => {
    const at = styles.indexOf("@media (pointer: coarse) {\n  .docs-copy {")
    expect(at).toBeGreaterThanOrEqual(0)
    return styles.slice(at, styles.indexOf("\n}\n", at))
  })()
  const inCoarse = (selector: string) => {
    const at = coarse.indexOf(`${selector} {`)
    expect(at, selector).toBeGreaterThanOrEqual(0)
    return coarse.slice(at, coarse.indexOf("}", at))
  }

  it("code-fence copy buttons are 44px on touch, and the floating one shows without a hover", () => {
    expect(inCoarse(".docs-copy")).toContain("min-width: 44px;")
    expect(inCoarse(".docs-copy")).toContain("min-height: 44px;")
    expect(inCoarse(".docs-code-header .docs-copy")).toContain("height: 44px;")
    expect(inCoarse(".docs-code-copy-float")).toContain("opacity: 1;")
  })

  it("a copy button's focus ring is visible, and outranks the hover-only opacity", () => {
    const ring = styles.lastIndexOf(".docs-copy:focus-visible {")
    const css = styles.slice(ring, styles.indexOf("}", ring))
    expect(css).toContain("outline: 2px solid var(--gb-primary);")
    expect(css).toContain("opacity: 1;")
    expect(ring).toBeGreaterThan(styles.indexOf(".docs-code-copy-float {"))
  })

  it("the replay player's controls and play disc are at least 44px on touch, in the replay layer", () => {
    expect(coarse).toContain("@layer docstream.replay {")
    expect(inCoarse(':where([data-slot="replay-preview-controls"] button, [data-slot="replay-preview-speed"])')).toContain("min-width: 44px;")
    expect(inCoarse(':where([data-slot="replay-preview-controls"] button, [data-slot="replay-preview-speed"])')).toContain("height: 44px;")
    expect(inCoarse(':where([data-slot="replay-preview-center"] > button)')).toContain("min-height: 44px;")
    const disc = styles.slice(styles.indexOf(':where([data-slot="replay-preview-center"] > button) {'))
    expect(disc.slice(0, disc.indexOf("}"))).toContain("width: 56px;")
  })

  it("the play disc follows the appearance: a light disc with a dark icon on light color-schemes", () => {
    const at = styles.indexOf(':where([data-slot="replay-preview-center"] > button) {')
    const css = styles.slice(at, styles.indexOf("}", at))
    expect(css).toContain("color: var(--replay-play-foreground, light-dark(#18181b, #ffffff));")
    expect(css).toContain("background: var(--replay-play-background, light-dark(rgba(255, 255, 255, 0.9), rgba(9, 9, 11, 0.72)));")
    expect(css).not.toContain("var(--foreground")
  })
})

describe("secondary text and code colors read at 4.5:1", () => {
  it("docstream's muted text pulls the host's muted color toward the text color", () => {
    expect(styles).toContain("--gb-muted-foreground: color-mix(in srgb, var(--muted-foreground, #71717a) 75%, var(--gb-panel-foreground));")
  })

  it("syntax tokens read --docs-tok-*, then CodeEditor's --bl-syntax-*, then the shared AA defaults", () => {
    for (const [kind, light, dark] of [
      ["keyword", "#8839C4", "#C792EA"], ["type", "#975300", "#FFCB6B"], ["function", "#2E5AD2", "#82AAFF"], ["string", "#0F732E", "#A5D6A7"],
      ["number", "#B73600", "#F78C6C"], ["constant", "#C11F39", "#F07178"], ["operator", "#006D80", "#89DDFF"], ["comment", "#63636E", "#9393A1"],
    ]) {
      expect(styles).toContain(`.docs-tok-${kind} { color: var(--docs-tok-${kind}, var(--bl-syntax-${kind}, light-dark(${light}, ${dark})));`)
    }
  })
})

describe("one syntax palette, AA in both schemes", () => {
  const kit = readFileSync(new URL("../../styles.css", import.meta.url), "utf8")
  const editor = readFileSync(new URL("../../docstream-editor/styles.css", import.meta.url), "utf8")
  const KINDS = ["keyword", "type", "function", "string", "number", "constant", "operator", "comment"]
  const pair = (sheet: string, re: (kind: string) => RegExp, kind: string) => {
    const m = re(kind).exec(sheet)
    expect(m, kind).not.toBeNull()
    return [m![1]!.toUpperCase(), m![2]!.toUpperCase()]
  }
  const ours = (kind: string) => pair(styles, (k) => new RegExp(`\\.docs-tok-${k} \\{[^}]*light-dark\\((#\\w{6}), (#\\w{6})\\)`), kind)
  const lum = (hex: string) => {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!
  }
  const ratio = (a: string, b: string) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05)

  it("CodeEditor (--bl-syntax-*), docstream (--docs-tok-*) and the editor draw the same colors", () => {
    for (const kind of KINDS) {
      expect(pair(kit, (k) => new RegExp(`\\.bl-tok-${k}\\{[^}]*light-dark\\((#\\w{6}),(#\\w{6})\\)`), kind), kind).toEqual(ours(kind))
      expect(pair(editor, (k) => new RegExp(`\\.gb-syntax-${k} \\{[^}]*light-dark\\((#\\w{6}), (#\\w{6})\\)`), kind), kind).toEqual(ours(kind))
    }
  })

  // The code surfaces each scheme draws tokens on: cards, fences and inline code, a highlighted or changed line.
  const LIGHT = ["#FFFFFF", "#EEEEEE", "#F2F2F7", "#E5E5EA", "#E2E2E8", "#DFEFFF", "#FFE9E8"]
  const DARK = ["#000000", "#1C1C1E", "#1E1E22", "#272729", "#2C2C2E"]
  it.each(KINDS)("%s reads at 4.5:1 on every code surface", (kind) => {
    const [light, dark] = ours(kind)
    for (const bg of LIGHT) expect(ratio(light!, bg), `${kind} ${light} on ${bg}`).toBeGreaterThanOrEqual(4.5)
    for (const bg of DARK) expect(ratio(dark!, bg), `${kind} ${dark} on ${bg}`).toBeGreaterThanOrEqual(4.5)
  })
})
