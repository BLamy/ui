import type { CSSProperties } from "react"

/*
 * A demo canvas's `surface` (inline style) has two spellings:
 * - `meta.json`: an object, `{ "background": "var(--brand-50)", "--demo-gap": "12px", "padding": 12 }`;
 * - the `{% demo surface="…" %}` attribute: CSS declarations,
 *   `background: var(--brand-50); --demo-gap: 12px; padding: 12`.
 * Keys are kept as written (camelCase, kebab-case or custom properties).
 */

/** A `meta.json` surface object as the declaration string the demo tag carries. */
export function surfaceToCss(surface: Record<string, string | number>): string {
  return Object.entries(surface)
    .filter(([key, value]) => key.trim() && value !== undefined && value !== null && String(value).trim() !== "")
    .map(([key, value]) => `${key.trim()}: ${String(value).trim()}`)
    .join("; ")
}

/** Split on `;` outside parentheses and quotes (`url("a;b")` stays whole). */
function declarations(css: string): string[] {
  const out: string[] = []
  let depth = 0
  let quote = ""
  let current = ""
  for (const ch of css) {
    if (quote) {
      if (ch === quote) quote = ""
    } else if (ch === '"' || ch === "'") quote = ch
    else if (ch === "(") depth++
    else if (ch === ")") depth = Math.max(0, depth - 1)
    else if (ch === ";" && depth === 0) {
      out.push(current)
      current = ""
      continue
    }
    current += ch
  }
  out.push(current)
  return out
}

/**
 * The tag's declaration string as a React style object. Custom properties keep their
 * name; `kebab-case` becomes camelCase; plain numbers on ordinary properties become
 * numbers (so `padding: 12` means 12px, as it does in `meta.json`).
 */
export function cssToSurface(css: string): Record<string, string | number> {
  const style: Record<string, string | number> = {}
  for (const declaration of declarations(css)) {
    const colon = declaration.indexOf(":")
    if (colon < 0) continue
    const key = declaration.slice(0, colon).trim()
    const value = declaration.slice(colon + 1).trim()
    if (!key || !value) continue
    if (key.startsWith("--")) {
      style[key] = value
      continue
    }
    const name = key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())
    style[name] = /^-?\d+(?:\.\d+)?$/.test(value) ? Number(value) : value
  }
  return style
}

export function surfaceStyle(surface: Record<string, string | number> | undefined): CSSProperties | undefined {
  return surface && Object.keys(surface).length ? (surface as CSSProperties) : undefined
}
