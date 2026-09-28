import type { Inline, InlineDelimiter, InlineImageNode, ReferenceNode, TextNode } from "./ast"

type Marks = Partial<Omit<TextNode, "type" | "text">>

// Reference-style link definitions ([ref]: url), populated by parseMarkdown
// and consumed here for [text][ref] / [text][] forms.
export const refDefinitions = new Map<string, string>()

// Footnote citation definitions ([^id]: url "Label"), populated by
// parseMarkdown and consumed here to resolve [^id] markers.
export const footnoteDefinitions = new Map<string, { url: string; label?: string }>()

// @mention / #tag / $codebase body: letter/underscore start, then word chars, dots,
// dashes. Codebase ids may also carry `/` (`$org/repo`). A letter start keeps prices
// like $5 plain text.
const REFERENCE_BODY_RE = /^[@#]([A-Za-z_][\w.-]*)/
const CODEBASE_BODY_RE = /^\$([A-Za-z_][\w.\/-]*)/
const SIGIL_KIND = { "@": "mention", "#": "tag", $: "codebase" } as const
const KIND_SIGIL = { mention: "@", tag: "#", codebase: "$" } as const
// Chips are only recognized at start-of-input or after whitespace, open brackets or an emphasis marker,
// so brett@replay.io and C# stay plain text.
const isReferenceBoundary = (prev: string | undefined) =>
  prev === undefined || /[\s([{*_~]/.test(prev)

function imgAttrs(attrStr: string): Omit<InlineImageNode, "type" | "link"> {
  const attr = (name: string) => attrStr.match(new RegExp(`${name}="([^"]*)"`, "i"))?.[1]
  const out: Omit<InlineImageNode, "type" | "link"> = { src: attr("src") ?? "" }
  const alt = attr("alt")
  const width = attr("width")
  const height = attr("height")
  if (alt) out.alt = alt
  if (width) out.width = width
  if (height) out.height = height
  return out
}

// ─── Parsing ─────────────────────────────────────────────────────────────────────────────────────────────
// Two passes, after CommonMark: tokenize (escapes, code spans, links, images, chips, autolinks and `*` / `_` /
// `~~` delimiter runs with their flanking), then pair the delimiter runs with the CommonMark "process
// emphasis" algorithm (rule of 3 included), which yields a tree. The tree is flattened into TextNodes; each
// remembers how its formatting was spelled (`delims`) whenever that differs from the default output.

type Mark = "bold" | "italic" | "strike" | "link"

type Tree =
  | { k: "text"; text: string }
  | { k: "code"; text: string }
  | { k: "atom"; node: InlineImageNode | ReferenceNode }
  | { k: "wrap"; delim: InlineDelimiter; url?: string; children: Tree[] }

interface DelimRun {
  k: "delim"
  ch: "*" | "_" | "~"
  /** Characters still unmatched. */
  n: number
  /** Length of the run as written (rule of 3). */
  orig: number
  open: boolean
  close: boolean
}

type Tok = Tree | DelimRun

const MARK_OF: Record<InlineDelimiter, Mark> = {
  "**": "bold",
  __: "bold",
  "*": "italic",
  _: "italic",
  "~~": "strike",
  link: "link",
  "<>": "link",
  url: "link",
}

const ASCII_PUNCT = /[!-/:-@[-`{-~]/
const isSpace = (c: string | undefined) => c === undefined || /\s/.test(c)
const isPunct = (c: string | undefined) => c !== undefined && /[\p{P}\p{S}]/u.test(c)

/** CommonMark left-/right-flanking for a delimiter run between `prev` and `next` (undefined = line edge). */
function flanking(prev: string | undefined, next: string | undefined) {
  return {
    left: !isSpace(next) && (!isPunct(next) || isSpace(prev) || isPunct(prev)),
    right: !isSpace(prev) && (!isPunct(prev) || isSpace(next) || isPunct(next)),
  }
}

/** Can a run of `ch` between `prev` and `next` open / close emphasis? */
function openClose(ch: string, prev: string | undefined, next: string | undefined) {
  const { left, right } = flanking(prev, next)
  if (ch !== "_") return { open: left, close: right }
  // `_` never opens or closes intraword: snake_case stays literal.
  return { open: left && (!right || isPunct(prev)), close: right && (!left || isPunct(next)) }
}

/** Start of the next backtick run of exactly `n` at or after `from`, or -1. */
function closingBackticks(src: string, from: number, n: number): number {
  let j = from
  while (j < src.length) {
    const k = src.indexOf("`", j)
    if (k === -1) return -1
    let m = 1
    while (src[k + m] === "`") m++
    if (m === n) return k
    j = k + m
  }
  return -1
}

const LINK_RE = /^\[((?:\\.|[^\]\\])*)\]\(([^)\s]+)\)/
const REF_LINK_RE = /^\[((?:\\.|[^\]\\])*)\]\[([^\]]*)\]/

/** `inLink`: tokenizing link text, where CommonMark allows no further links (or autolinks). */
function tokenize(src: string, inLink = false): Tok[] {
  const toks: Tok[] = []
  let buf = ""
  const push = (t: Tok) => {
    if (buf) toks.push({ k: "text", text: buf })
    buf = ""
    toks.push(t)
  }
  const wrap = (delim: InlineDelimiter, url: string, inner: string | Tree[]): Tok => ({
    k: "wrap",
    delim,
    url,
    children: typeof inner === "string" ? pairEmphasis(tokenize(inner, true)) : inner,
  })

  let i = 0
  while (i < src.length) {
    const c = src[i]
    const rest = src.slice(i)

    // Backslash escapes: ASCII punctuation only; `C:\path` keeps its backslash.
    if (c === "\\" && i + 1 < src.length && ASCII_PUNCT.test(src[i + 1])) {
      buf += src[i + 1]
      i += 2
      continue
    }

    // Code span: a backtick run closed by the next run of the same length. Content is kept verbatim.
    if (c === "`") {
      let n = 1
      while (src[i + n] === "`") n++
      const end = closingBackticks(src, i + n, n)
      if (end !== -1) {
        push({ k: "code", text: src.slice(i + n, end) })
        i = end + n
      } else {
        buf += src.slice(i, i + n)
        i += n
      }
      continue
    }

    if (c === "<") {
      // <a href="…"><img …></a> — linked image (GitHub badge style)
      const linkedImg = rest.match(/^<a\s[^>]*href="([^"]*)"[^>]*>\s*<img\s([^>]*?)\/?>\s*<\/a>/i)
      if (linkedImg) {
        push({ k: "atom", node: { type: "image", ...imgAttrs(linkedImg[2]), link: linkedImg[1] } })
        i += linkedImg[0].length
        continue
      }
      // <img …> — bare inline image
      const htmlImg = rest.match(/^<img\s([^>]*?)\/?>/i)
      if (htmlImg) {
        push({ k: "atom", node: { type: "image", ...imgAttrs(htmlImg[1]) } })
        i += htmlImg[0].length
        continue
      }
      // <a href="…">text</a> — html link
      const htmlLink = !inLink && rest.match(/^<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/i)
      if (htmlLink) {
        push(wrap("link", htmlLink[1], htmlLink[2]))
        i += htmlLink[0].length
        continue
      }
      // <https://…> — angle-bracket autolink
      const angleLink = !inLink && rest.match(/^<(https?:\/\/[^>\s]+)>/i)
      if (angleLink) {
        push(wrap("<>", angleLink[1], [{ k: "text", text: angleLink[1] }]))
        i += angleLink[0].length
        continue
      }
    }

    // ![alt](src) — markdown inline image
    if (c === "!") {
      const mdImg = rest.match(/^!\[([^\]]*)\]\(([^)\s]+)\)/)
      if (mdImg) {
        push({ k: "atom", node: { type: "image", src: mdImg[2], ...(mdImg[1] ? { alt: mdImg[1] } : {}) } })
        i += mdImg[0].length
        continue
      }
    }

    if (c === "[") {
      // [^id] — footnote citation marker
      const cite = rest.match(/^\[\^([^\]\s]+)\]/)
      if (cite) {
        const def = footnoteDefinitions.get(cite[1])
        push({ k: "atom", node: { type: "reference", kind: "citation", id: cite[1], ...def } })
        i += cite[0].length
        continue
      }
      // [text](url) — link text is its own emphasis scope, as in CommonMark
      const m = !inLink && rest.match(LINK_RE)
      if (m) {
        push(wrap("link", m[2], m[1]))
        i += m[0].length
        continue
      }
      // [text][ref] / [text][] — reference-style links
      const ref = !inLink && rest.match(REF_LINK_RE)
      if (ref) {
        const url = refDefinitions.get((ref[2] || ref[1]).toLowerCase())
        if (url) {
          push(wrap("link", url, ref[1]))
          i += ref[0].length
          continue
        }
      }
    }

    // @mention / #tag / $codebase chips, only at a word boundary
    if ((c === "@" || c === "#" || c === "$") && isReferenceBoundary(src[i - 1])) {
      const m = rest.match(c === "$" ? CODEBASE_BODY_RE : REFERENCE_BODY_RE)
      if (m) {
        const id = m[1].replace(/[./-]+$/, "")
        if (id) {
          push({ k: "atom", node: { type: "reference", kind: SIGIL_KIND[c], id } })
          i += 1 + id.length
          continue
        }
      }
    }

    // bare URL autolink (GFM) — at start, after whitespace or an emphasis marker
    if (!inLink && (c === "h" || c === "H") && /^https?:\/\//i.test(rest) && (i === 0 || /[\s*_~]/.test(src[i - 1]))) {
      const m = rest.match(/^https?:\/\/[^\s<>"')\]]+/i)!
      const url = m[0].replace(/[.,;:!?*_~]+$/, "")
      push(wrap("url", url, [{ k: "text", text: url }]))
      i += url.length
      continue
    }

    // Delimiter runs: any run of `*` / `_`, exactly two `~`.
    if (c === "*" || c === "_" || (c === "~" && src[i + 1] === "~")) {
      let n = 1
      while (src[i + n] === c) n++
      if (c === "~" && n !== 2) {
        buf += src.slice(i, i + n)
        i += n
        continue
      }
      push({ k: "delim", ch: c, n, orig: n, ...openClose(c, src[i - 1], src[i + n]) })
      i += n
      continue
    }

    buf += c
    i++
  }
  if (buf) toks.push({ k: "text", text: buf })
  return toks
}

/** Leftover delimiter runs become literal text; adjacent text merges. */
function settle(toks: Tok[]): Tree[] {
  const out: Tree[] = []
  for (const t of toks) {
    const tree: Tree = t.k === "delim" ? { k: "text", text: t.ch.repeat(t.n) } : t
    const last = out[out.length - 1]
    if (tree.k === "text" && last?.k === "text") out[out.length - 1] = { k: "text", text: last.text + tree.text }
    else if (tree.k !== "text" || tree.text) out.push(tree)
  }
  return out
}

/** CommonMark "process emphasis": pair closers with the nearest eligible opener, innermost first. */
function pairEmphasis(toks: Tok[]): Tree[] {
  let ci = 0
  while (ci < toks.length) {
    const closer = toks[ci]
    if (closer.k !== "delim" || !closer.close || closer.n === 0) {
      ci++
      continue
    }
    let oi = ci - 1
    for (; oi >= 0; oi--) {
      const o = toks[oi]
      if (o.k !== "delim" || o.ch !== closer.ch || !o.open || o.n === 0) continue
      if (closer.ch === "~") {
        if (o.n === 2 && closer.n === 2) break
        continue
      }
      // Rule of 3: a run that can both open and close can't pair with one whose lengths sum to a multiple of 3.
      const both = o.close || closer.open
      if (both && (o.orig + closer.orig) % 3 === 0 && !(o.orig % 3 === 0 && closer.orig % 3 === 0)) continue
      break
    }
    if (oi < 0) {
      ci++
      continue
    }
    const opener = toks[oi] as DelimRun
    const use = closer.ch === "~" ? 2 : opener.n >= 2 && closer.n >= 2 ? 2 : 1
    const delim = (closer.ch === "~" ? "~~" : closer.ch.repeat(use)) as InlineDelimiter
    const node: Tree = { k: "wrap", delim, children: settle(toks.slice(oi + 1, ci)) }
    opener.n -= use
    closer.n -= use
    const replaced: Tok[] = [...(opener.n > 0 ? [opener] : []), node, ...(closer.n > 0 ? [closer] : [])]
    toks.splice(oi, ci - oi + 1, ...replaced)
    // Continue with the closer's remainder (it may close an outer opener too), or what follows it.
    ci = oi + replaced.length - (closer.n > 0 ? 1 : 0)
  }
  return settle(toks)
}

/** The spelling a run gets when nothing says otherwise — what serialization produced before `delims`. */
function defaultDelims(n: TextNode): InlineDelimiter[] {
  const emphasis: InlineDelimiter[] = []
  if (n.strike) emphasis.push("~~")
  if (n.italic) emphasis.push("_")
  if (n.bold) emphasis.push("**")
  if (!n.link) return emphasis
  const inner = !!n.linkInner && emphasis.length > 0
  const form: InlineDelimiter = (inner || !emphasis.length) && n.text === n.link && !n.code ? "url" : "link"
  return inner ? [...emphasis, form] : [form, ...emphasis]
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, k) => x === b[k])

function flatten(trees: Tree[], path: Array<{ delim: InlineDelimiter; url?: string }>, base: Marks, out: Inline[]) {
  for (const t of trees) {
    if (t.k === "wrap") {
      flatten(t.children, [...path, { delim: t.delim, url: t.url }], base, out)
      continue
    }
    if (t.k === "atom") {
      out.push(t.node)
      continue
    }
    const n: TextNode = { type: "text", text: t.text, ...base }
    let emphasis = false
    for (const e of path) {
      const mark = MARK_OF[e.delim]
      if (mark === "link") {
        n.link = e.url
        if (emphasis) n.linkInner = true
      } else {
        n[mark] = true
        emphasis = true
      }
    }
    if (t.k === "code") n.code = true
    const delims = path.map((e) => e.delim)
    if (!sameList(delims, defaultDelims(n))) n.delims = delims
    out.push(n)
  }
}

// Parses GitBook/GFM inline markdown into flat TextNodes with marks.
// Supported: **bold** / __bold__, _italic_ / *italic*, ***both***, ~~strike~~, `code`, [text](url),
// [text][ref], <url> and bare URLs, @mention / #tag / $codebase / [^n] chips, ![alt](src),
// plus GitHub-style inline HTML: <img …>, <a href><img …></a>, <a href>text</a>.
export function parseInline(src: string, marks: Marks = {}): Inline[] {
  const out: Inline[] = []
  flatten(pairEmphasis(tokenize(src)), [], marks, out)
  return out
}

// ─── Serializing ─────────────────────────────────────────────────────────────────────────────────────────

export function serializeReference(n: ReferenceNode): string {
  if (n.kind === "citation") return `[^${n.id}]`
  return `${KIND_SIGIL[n.kind]}${n.id}`
}

function serializeImage(n: InlineImageNode): string {
  const attrs = [
    `src="${n.src}"`,
    n.alt ? `alt="${n.alt}"` : "",
    n.width ? `width="${n.width}"` : "",
    n.height ? `height="${n.height}"` : "",
  ]
    .filter(Boolean)
    .join(" ")
  const img = `<img ${attrs} />`
  return n.link ? `<a href="${n.link}">${img}</a>` : img
}

interface Entry {
  mark: Mark
  delim: InlineDelimiter
  url?: string
}

/** The run's formatting, outermost → innermost: its `delims` hint reconciled with its actual marks. */
function entriesFor(n: TextNode): Entry[] {
  const fallback = defaultDelims(n)
  let delims = fallback
  if (n.delims?.length) {
    const has = (m: Mark) => (m === "link" ? !!n.link : !!n[m])
    delims = []
    for (const d of n.delims) {
      const m = MARK_OF[d]
      if (m && has(m) && !(m === "link" && delims.some((x) => MARK_OF[x] === "link"))) delims.push(d)
    }
    // Marks without a spelling: emphasis innermost (inside a trailing link), the link where it defaults to.
    for (const d of fallback) {
      const m = MARK_OF[d]
      if (delims.some((x) => MARK_OF[x] === m)) continue
      if (m === "link") {
        if (n.linkInner) delims.push(d)
        else delims.unshift(d)
      } else {
        const last = delims[delims.length - 1]
        delims.splice(last && MARK_OF[last] === "link" ? delims.length - 1 : delims.length, 0, d)
      }
    }
    // An autolink shows its URL as its text: only valid innermost, around an unchanged URL.
    delims = delims.map((d, k) =>
      (d === "url" || d === "<>") && (k !== delims.length - 1 || n.text !== n.link || n.code) ? "link" : d,
    )
  }
  return delims.map((delim) => ({ mark: MARK_OF[delim], delim, ...(MARK_OF[delim] === "link" ? { url: n.link } : {}) }))
}

/**
 * The spelling `serializeInline` gives a text run, outermost → innermost: its `delims` hint reconciled with
 * its marks. Editors can store it per mark and hand it back as `delims`.
 */
export function inlineDelims(n: TextNode): InlineDelimiter[] {
  return entriesFor(n).map((e) => e.delim)
}

/** The spelling a text run gets without a `delims` hint; a hint equal to it can be dropped. */
export function defaultInlineDelims(n: TextNode): InlineDelimiter[] {
  return defaultDelims(n)
}

const sameEntry = (a: Entry, b: Entry) => a.delim === b.delim && a.url === b.url
const opener = (e: Entry) => (e.mark !== "link" ? e.delim : e.delim === "link" ? "[" : e.delim === "<>" ? "<" : "")
const closer = (e: Entry) => (e.mark !== "link" ? e.delim : e.delim === "link" ? `](${e.url})` : e.delim === "<>" ? ">" : "")

function codeSpan(t: string): string {
  const runs = new Set((t.match(/`+/g) ?? []).map((r) => r.length))
  let n = 1
  while (runs.has(n)) n++
  const fence = "`".repeat(n)
  const pad = t.startsWith("`") || t.endsWith("`") ? " " : ""
  return `${fence}${pad}${t}${pad}${fence}`
}

/** A piece of output: markdown syntax (verbatim) or literal text (escaped on render). */
interface Piece {
  s: string
  text?: boolean
  /** Literal text inside `[…]` link text, where `]` must be escaped. */
  inLink?: boolean
}

/**
 * Does literal `raw[i]` need a backslash? `minimal` escapes only what would otherwise parse as syntax —
 * judged against the whole rendered line, so snake_case, `2 * 3`, `~5 min` and `a [b] c` stay as written.
 */
function needsEscape(raw: string, text: Uint8Array, inLink: Uint8Array, i: number, minimal: boolean) {
  const c = raw[i]
  switch (c) {
    case "\\":
      return !minimal || i + 1 >= raw.length || ASCII_PUNCT.test(raw[i + 1])
    case "`":
      return true
    case "[":
      return !minimal || raw[i + 1] === "^" || /^\[(?:\\.|[^\]\\])*\][([]/.test(raw.slice(i))
    case "]":
      return !minimal || inLink[i] === 1
    case "@":
    case "#":
    case "$":
      // Only at a chip boundary, so emails / C# / $5 survive untouched.
      return isReferenceBoundary(raw[i - 1]) && /[A-Za-z_]/.test(raw[i + 1] ?? "")
    case "*":
    case "_":
    case "~": {
      if (!minimal) return true
      let s = i
      let e = i + 1
      while (s > 0 && raw[s - 1] === c) s--
      while (e < raw.length && raw[e] === c) e++
      for (let k = s; k < e; k++) if (!text[k]) return true // touches a marker: always escape
      if (c === "~") return e - s >= 2
      const { open, close } = openClose(c, raw[s - 1], raw[e])
      return open || close
    }
  }
  return false
}

/** The rendered line: its characters, and which literal ones get a backslash. */
interface Rendering {
  raw: string
  escape: Uint8Array
}

function render(pieces: Piece[], minimal: boolean): Rendering {
  const raw = pieces.map((p) => p.s).join("")
  const text = new Uint8Array(raw.length)
  const inLink = new Uint8Array(raw.length)
  let at = 0
  for (const p of pieces) {
    if (p.text) text.fill(1, at, at + p.s.length)
    if (p.inLink) inLink.fill(1, at, at + p.s.length)
    at += p.s.length
  }
  const escape = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    if (text[i] && /[\\`*_~[\]@#$]/.test(raw[i]) && needsEscape(raw, text, inLink, i, minimal)) escape[i] = 1
  }
  return { raw, escape }
}

const written = ({ raw, escape }: Rendering) => {
  let out = ""
  for (let i = 0; i < raw.length; i++) out += escape[i] ? `\\${raw[i]}` : raw[i]
  return out
}

/**
 * Drop backslashes the line can do without — `footnote*`, a lone backtick, `[x]` before a `(` that isn't a
 * link. An escaped run is dropped only if the line still means `want` with every escaped run of the same
 * character unescaped too, so paired escapes (`\*x\*`, `` \`x\` ``) keep both backslashes.
 */
function relax(r: Rendering, want: string): string {
  const original = written(r)
  const groups: Array<{ start: number; end: number; ch: string }> = []
  for (let i = 0; i < r.raw.length; i++) {
    const ch = r.raw[i]
    if (!r.escape[i] || !/[`*_~[]/.test(ch)) continue
    let end = i + 1
    if (ch !== "`" && ch !== "[") while (r.escape[end] && r.raw[end] === ch) end++
    groups.push({ start: i, end, ch })
    i = end - 1
  }
  if (!groups.length || groups.length > 32) return original
  const without = (drop: (g: (typeof groups)[number]) => boolean) => {
    const escape = r.escape.slice()
    for (const g of groups) if (drop(g)) escape.fill(0, g.start, g.end)
    return written({ raw: r.raw, escape })
  }
  const droppable = new Set(groups.filter((g) => meaning(parseInline(without((o) => o.ch === g.ch))) === want))
  if (!droppable.size) return original
  const relaxed = without((g) => droppable.has(g))
  return meaning(parseInline(relaxed)) === want ? relaxed : original
}

/** What a line means, ignoring spelling: merged text runs with their marks, plus atoms. */
function meaning(nodes: Inline[]): string {
  const parts: unknown[] = []
  let last: { key: string; text: string } | undefined
  for (const n of nodes) {
    if (n.type !== "text") {
      last = undefined
      parts.push(n.type === "image" ? ["img", n.src, n.link ?? ""] : ["ref", n.kind, n.id])
      continue
    }
    if (!n.text) continue
    const key = JSON.stringify([!!n.bold, !!n.italic, !!n.strike, !!n.code, n.link ?? ""])
    if (last && last.key === key && !n.code) last.text += n.text
    else parts.push((last = { key, text: n.text }))
  }
  return JSON.stringify(parts)
}

// Serializes inline nodes back to markdown, as written: each run's `delims` restores the author's markers
// and nesting, and formatting shared by adjacent runs is opened once — `**bold [link](url) inside**` and
// `[**a** b](url)` come back whole instead of per run. Text is escaped minimally; if the minimal form would
// parse back differently, everything escapable is escaped instead.
export function serializeInline(nodes: Inline[]): string {
  const pieces: Piece[] = []
  const open: Entry[] = []
  const closeTo = (depth: number) => {
    while (open.length > depth) pieces.push({ s: closer(open.pop()!) })
  }
  for (const n of nodes) {
    if (n.type !== "text") {
      closeTo(0)
      pieces.push({ s: n.type === "image" ? serializeImage(n) : serializeReference(n) })
      continue
    }
    if (!n.text) continue
    const wanted = entriesFor(n)
    // Keep the open formatting this run still wants (outermost first), close the rest, open what's missing.
    const missing = [...wanted]
    let keep = 0
    for (; keep < open.length; keep++) {
      const k = missing.findIndex((w) => sameEntry(w, open[keep]))
      if (k < 0) break
      missing.splice(k, 1)
    }
    closeTo(keep)
    for (const w of missing) {
      open.push(w)
      pieces.push({ s: opener(w) })
    }
    const innermost = open[open.length - 1]
    if (n.code) pieces.push({ s: codeSpan(n.text) })
    else if (innermost?.mark === "link" && innermost.delim !== "link") pieces.push({ s: n.text }) // autolink
    else pieces.push({ s: n.text, text: true, inLink: open.some((e) => e.delim === "link") })
  }
  closeTo(0)

  const minimal = render(pieces, true)
  if (!pieces.some((p) => p.text)) return written(minimal)
  const want = meaning(nodes)
  if (meaning(parseInline(written(minimal))) === want) return relax(minimal, want)
  const full = written(render(pieces, false))
  return meaning(parseInline(full)) === want ? full : written(minimal)
}

export function plainText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      if (n.type === "text") return n.text
      if (n.type === "reference") {
        // Citation superscripts are visual noise in plain text (titles etc.).
        return n.kind === "citation" ? "" : serializeReference(n)
      }
      return n.alt ?? ""
    })
    .join("")
}
