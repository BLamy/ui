/*
 * Tag and fence attribute values (`{% demo title="…" %}`, ```` ```ts title="…" ````).
 *
 * Values are double-quoted. On serialize a backslash becomes `\\`, a double quote `\"`,
 * and the tag terminator `%}` becomes `%\}` — so a value can never end its tag early or
 * truncate at a quote. On parse `\\`, `\"` and `\}` are unescaped; any other backslash is
 * kept literally (so `C:\temp` written by hand still reads as written).
 */

/** Escape one attribute value for a double-quoted `name="…"` pair. */
export function escapeAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/%\}/g, "%\\}")
}

/** Undo `escapeAttr`. */
export function unescapeAttr(raw: string): string {
  return raw.replace(/\\(["\\}])/g, "$1")
}

/** ` name="value"` with the value escaped (leading space included). */
export function attr(name: string, value: string | number | boolean): string {
  return ` ${name}="${escapeAttr(String(value))}"`
}

/** Every `name="value"` pair in `raw` (escapes honoured, values unescaped). */
export function parseAttrs(raw: string | undefined): Record<string, string> {
  const attrs: Record<string, string> = {}
  if (!raw) return attrs
  for (const m of raw.matchAll(/([\w-]+)="((?:[^"\\]|\\.)*)"/g)) {
    attrs[m[1]] = unescapeAttr(m[2])
  }
  return attrs
}

/**
 * The attribute part of a `{% name … %}` tag, as a regex source: anything up to the
 * closing `%}` (a lone `%` is fine; `%}` inside a value is always escaped as `%\}`).
 */
export const TAG_ATTRS = String.raw`(?:[^%\n]|%(?!\}))*?`
