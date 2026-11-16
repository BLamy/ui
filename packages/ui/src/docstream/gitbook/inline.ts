import type { Inline, InlineDelimiter, InlineImageNode, LinkForm, ReferenceNode, TextNode } from "./ast"

type Marks = Partial<Omit<TextNode, "type" | "text">>

// Reference-style link definitions ([ref]: url), populated by parseMarkdown
// and consumed here for [text][ref] / [text][] / [text] forms. Keys are normalized labels.
export const refDefinitions = new Map<string, string>()

// Footnote citation definitions ([^id]: url "Label"), populated by
// parseMarkdown and consumed here to resolve [^id] markers.
export const footnoteDefinitions = new Map<string, { url: string; label?: string }>()

/** A reference label as matched against definitions: case-insensitive, inner whitespace collapsed. */
export function normalizeLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase()
}

// @mention / #tag / $codebase body: letter/underscore start, then word chars, dots,
// dashes. Codebase ids may also carry `/` (`$org/repo`). A letter start keeps prices
// like $5 plain text.
const REFERENCE_BODY_RE = /^[@#]([A-Za-z_][\w.-]*)/
const CODEBASE_BODY_RE = /^\$([A-Za-z_][\w./-]*)/
const SIGIL_KIND = { "@": "mention", "#": "tag", $: "codebase" } as const
const KIND_SIGIL = { mention: "@", tag: "#", codebase: "$" } as const
// Chips are only recognized at start-of-input or after whitespace, open brackets or an emphasis marker,
// so brett@replay.io and C# stay plain text.
const isReferenceBoundary = (prev: string | undefined) =>
  prev === undefined || /[\s([{*_~]/.test(prev)

type ImgAttrs = Pick<InlineImageNode, "src" | "alt" | "width" | "height">

function imgAttrs(attrStr: string): ImgAttrs {
  const attr = (name: string) => attrStr.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`, "i"))?.[1]
  const out: ImgAttrs = { src: attr("src") ?? "" }
  const alt = attr("alt")
  const width = attr("width")
  const height = attr("height")
  if (alt) out.alt = alt
  if (width) out.width = width
  if (height) out.height = height
  return out
}

const LINKED_IMG_RE = /^<a\s[^>]*href="([^"]*)"[^>]*>\s*<img\s([^>]*?)\/?>\s*<\/a>/i
const HTML_IMG_RE = /^<img\s([^>]*?)\/?>/i

/** What an image's recorded HTML says — `null` when it isn't an (optionally linked) `<img>`. */
function htmlImage(html: string): (ImgAttrs & { link?: string }) | null {
  const linked = html.match(LINKED_IMG_RE)
  if (linked && linked[0] === html) return { ...imgAttrs(linked[2]), link: linked[1] }
  const bare = html.match(HTML_IMG_RE)
  if (bare && bare[0] === html) return imgAttrs(bare[1])
  return null
}

// ─── Parsing ─────────────────────────────────────────────────────────────────────────────────────────────
// Two passes, after CommonMark: tokenize (escapes, code spans, links, images, chips, autolinks and `*` / `_` /
// `~~` delimiter runs with their flanking), then pair the delimiter runs with the CommonMark "process
// emphasis" algorithm (rule of 3 included), which yields a tree. The tree is flattened into inlines that all
// carry their marks; each remembers how its formatting was spelled (`delims`, link form, title, reference
// label, HTML tag) whenever that differs from the default output, and escaped characters stay their own runs.

type Mark = "bold" | "italic" | "strike" | "link"

/** A link as written: target plus the form-specific details. */
interface LinkInfo {
  url: string
  title?: string
  ref?: string
  tag?: string
  close?: string
}

type Tree =
  | { k: "text"; text: string }
  | { k: "esc"; text: string }
  | { k: "code"; text: string; ticks?: number }
  | { k: "atom"; node: InlineImageNode | ReferenceNode }
  | { k: "wrap"; delim: InlineDelimiter; link?: LinkInfo; children: Tree[] }

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
  ref: "link",
  collapsed: "link",
  shortcut: "link",
  html: "link",
}

const isLinkForm = (d: InlineDelimiter): d is LinkForm => MARK_OF[d] === "link"
/** Link forms whose text sits between `[` and `]`. */
const BRACKETED = new Set<InlineDelimiter>(["link", "ref", "collapsed", "shortcut"])

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

/** Index of the `]` closing the `[` at `start` — brackets nest, escapes and code spans are skipped — or -1. */
function closingBracket(src: string, start: number): number {
  let depth = 0
  for (let j = start; j < src.length; j++) {
    const c = src[j]
    if (c === "\\") {
      j++
      continue
    }
    if (c === "`") {
      let n = 1
      while (src[j + n] === "`") n++
      const end = closingBackticks(src, j + n, n)
      j = (end === -1 ? j + n : end + n) - 1
      continue
    }
    if (c === "[") depth++
    else if (c === "]" && --depth === 0) return j
  }
  return -1
}

/** `(url)` or `(url "title")` at the start of `rest`. */
const LINK_TAIL_RE = /^\(([^)\s]+)(?:[ \t]+"((?:\\.|[^"\\])*)")?\)/
const HTML_LINK_RE = /^(<a\s[^>]*?href="([^"]*)"[^>]*>)(.*?)(<\/a\s*>)/i

interface Ctx {
  defs: ReadonlyMap<string, string>
}

/** `inLink`: tokenizing link text, where CommonMark allows no further links (or autolinks). */
function tokenize(src: string, ctx: Ctx, inLink = false): Tok[] {
  const toks: Tok[] = []
  let buf = ""
  const flush = () => {
    if (buf) toks.push({ k: "text", text: buf })
    buf = ""
  }
  const push = (t: Tok) => {
    flush()
    toks.push(t)
  }
  const wrap = (delim: InlineDelimiter, link: LinkInfo, inner: string | Tree[]): Tok => ({
    k: "wrap",
    delim,
    link,
    children: typeof inner === "string" ? pairEmphasis(tokenize(inner, ctx, true)) : inner,
  })

  let i = 0
  while (i < src.length) {
    const c = src[i]
    const rest = src.slice(i)

    // Backslash escapes: ASCII punctuation only; `C:\path` keeps its backslash. Escaped characters are their
    // own run, so the author's backslashes come back even where they aren't needed.
    if (c === "\\" && i + 1 < src.length && ASCII_PUNCT.test(src[i + 1])) {
      flush()
      const last = toks[toks.length - 1]
      if (last?.k === "esc") last.text += src[i + 1]
      else toks.push({ k: "esc", text: src[i + 1] })
      i += 2
      continue
    }

    // Code span: a backtick run closed by the next run of the same length. Content is kept verbatim.
    if (c === "`") {
      let n = 1
      while (src[i + n] === "`") n++
      const end = closingBackticks(src, i + n, n)
      if (end !== -1) {
        push({ k: "code", text: src.slice(i + n, end), ...(n > 1 ? { ticks: n } : {}) })
        i = end + n
      } else {
        buf += src.slice(i, i + n)
        i += n
      }
      continue
    }

    if (c === "<") {
      // <a href="…"><img …></a> — linked image (GitHub badge style)
      const linkedImg = !inLink && rest.match(LINKED_IMG_RE)
      if (linkedImg) {
        push({ k: "atom", node: { type: "image", ...imgAttrs(linkedImg[2]), link: linkedImg[1], html: linkedImg[0] } })
        i += linkedImg[0].length
        continue
      }
      // <img …> — bare inline image
      const htmlImg = rest.match(HTML_IMG_RE)
      if (htmlImg) {
        push({ k: "atom", node: { type: "image", ...imgAttrs(htmlImg[1]), html: htmlImg[0] } })
        i += htmlImg[0].length
        continue
      }
      // <a href="…">text</a> — html link, its opening tag kept as written
      const htmlLink = !inLink && rest.match(HTML_LINK_RE)
      if (htmlLink) {
        push(wrap("html", { url: htmlLink[2], tag: htmlLink[1], ...(htmlLink[4] !== "</a>" ? { close: htmlLink[4] } : {}) }, htmlLink[3]))
        i += htmlLink[0].length
        continue
      }
      // <https://…> — angle-bracket autolink
      const angleLink = !inLink && rest.match(/^<(https?:\/\/[^>\s]+)>/i)
      if (angleLink) {
        push(wrap("<>", { url: angleLink[1] }, [{ k: "text", text: angleLink[1] }]))
        i += angleLink[0].length
        continue
      }
    }

    // ![alt](src "title") — markdown inline image; ![alt][ref] / ![alt][] / ![alt] through a definition
    if (c === "!" && src[i + 1] === "[") {
      const close = closingBracket(src, i + 1)
      const tail = close !== -1 ? src.slice(close + 1).match(LINK_TAIL_RE) : null
      const alt = close !== -1 ? src.slice(i + 2, close) : ""
      if (close !== -1 && !tail) {
        const ref = src.slice(close + 1).match(/^\[((?:\\.|[^\]\\])*)\]/)
        const label = ref ? ref[1] || alt : alt
        const url = label.trim() ? ctx.defs.get(normalizeLabel(label)) : undefined
        if (url !== undefined) {
          const srcForm = ref ? (ref[1] ? "ref" : "collapsed") : "shortcut"
          push({
            k: "atom",
            node: { type: "image", src: url, ...(alt ? { alt } : {}), syntax: "markdown", srcForm, srcRef: label },
          })
          i = close + 1 + (ref ? ref[0].length : 0)
          continue
        }
      }
      if (tail) {
        push({
          k: "atom",
          node: {
            type: "image",
            src: tail[1],
            ...(alt ? { alt } : {}),
            ...(tail[2] !== undefined ? { title: tail[2] } : {}),
            syntax: "markdown",
          },
        })
        i = close + 1 + tail[0].length
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
      const close = inLink ? -1 : closingBracket(src, i)
      if (close !== -1) {
        const text = src.slice(i + 1, close)
        const after = src.slice(close + 1)
        // [text](url "title") — link text is its own emphasis scope, as in CommonMark
        const tail = after.match(LINK_TAIL_RE)
        if (tail) {
          push(wrap("link", { url: tail[1], ...(tail[2] !== undefined ? { title: tail[2] } : {}) }, text))
          i = close + 1 + tail[0].length
          continue
        }
        // [text][ref] / [text][] — reference-style links
        const ref = after.match(/^\[((?:\\.|[^\]\\])*)\]/)
        const refUrl = ref ? ctx.defs.get(normalizeLabel(ref[1] || text)) : undefined
        if (ref && refUrl !== undefined) {
          push(wrap(ref[1] ? "ref" : "collapsed", { url: refUrl, ref: ref[1] || text }, text))
          i = close + 1 + ref[0].length
          continue
        }
        // [ref] — shortcut reference link
        const shortcut = text.trim() ? ctx.defs.get(normalizeLabel(text)) : undefined
        if (shortcut !== undefined) {
          push(wrap("shortcut", { url: shortcut, ref: text }, text))
          i = close + 1
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
      push(wrap("url", { url }, [{ k: "text", text: url }]))
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
  flush()
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

/** Is the inline's `link` a link mark (rather than the HTML anchor of an `<a href><img></a>` image)? */
function linkIsMark(n: Inline): boolean {
  if (!n.link) return false
  return n.type !== "image" || !!n.delims?.some(isLinkForm)
}

/** The spelling an inline gets when nothing says otherwise — what serialization produced before `delims`. */
function defaultDelims(n: Inline): InlineDelimiter[] {
  const emphasis: InlineDelimiter[] = []
  if (n.strike) emphasis.push("~~")
  if (n.italic) emphasis.push("_")
  if (n.bold) emphasis.push("**")
  // An image's link is its HTML anchor unless the spelling says otherwise.
  if (!n.link || n.type === "image") return emphasis
  const inner = !!n.linkInner && emphasis.length > 0
  const form: InlineDelimiter =
    n.type === "text" && (inner || !emphasis.length) && n.text === n.link && !n.code && !n.escaped ? "url" : "link"
  return inner ? [...emphasis, form] : [form, ...emphasis]
}

const sameList = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, k) => x === b[k])

interface PathEntry {
  delim: InlineDelimiter
  link?: LinkInfo
  /** Which link (wrap) this is, for link identity. */
  seq?: number
}

interface FlattenState {
  seq: number
  /** The link wrap each output inline belongs to. */
  linkSeq: Map<Inline, number>
}

function applyPath(n: Inline, path: PathEntry[], state: FlattenState) {
  let emphasis = false
  for (const e of path) {
    const mark = MARK_OF[e.delim]
    if (mark === "link") {
      const link = e.link!
      n.link = link.url
      if (link.title !== undefined) n.linkTitle = link.title
      if (link.ref !== undefined) n.linkRef = link.ref
      if (link.tag !== undefined) n.linkTag = link.tag
      if (link.close !== undefined) n.linkTagEnd = link.close
      if (emphasis) n.linkInner = true
      state.linkSeq.set(n, e.seq!)
    } else {
      n[mark] = true
      emphasis = true
    }
  }
  const delims = path.map((e) => e.delim)
  if (!sameList(delims, defaultDelims(n))) n.delims = delims
}

function flatten(trees: Tree[], path: PathEntry[], base: Marks, out: Inline[], state: FlattenState) {
  for (const t of trees) {
    if (t.k === "wrap") {
      const entry: PathEntry = { delim: t.delim, ...(t.link ? { link: t.link, seq: ++state.seq } : {}) }
      const before = out.length
      flatten(t.children, [...path, entry], base, out, state)
      // An empty link (`[](url)`) is an empty run, so it isn't lost.
      if (t.link && out.length === before) {
        const n: TextNode = { type: "text", text: "", ...base }
        applyPath(n, [...path, entry], state)
        out.push(n)
      }
      continue
    }
    if (t.k === "atom") {
      const node = { ...t.node }
      applyPath(node, path, state)
      out.push(node)
      continue
    }
    const n: TextNode = { type: "text", text: t.text, ...base }
    if (t.k === "code") {
      n.code = true
      if (t.ticks && t.ticks !== codeSpanTicks(t.text)) n.ticks = t.ticks
    }
    if (t.k === "esc") n.escaped = true
    applyPath(n, path, state)
    out.push(n)
  }
}

/** What makes two link runs the same link to the serializer (everything but identity). */
function linkKey(n: Inline): string {
  const form = inlineDelims(n).find(isLinkForm) ?? ""
  return JSON.stringify([n.link, form, n.linkTitle ?? null, n.linkRef ?? null, n.linkTag ?? null, n.linkTagEnd ?? null])
}

/** Adjacent links to the same target stay distinct: the later one gets a `linkId`. */
function markLinkIdentity(out: Inline[], state: FlattenState) {
  let next = 1
  const ids = new Map<number, number>()
  for (let k = 1; k < out.length; k++) {
    const a = out[k - 1]
    const b = out[k]
    const sa = state.linkSeq.get(a)
    const sb = state.linkSeq.get(b)
    if (sa === undefined || sb === undefined || sa === sb || !linkIsMark(a) || !linkIsMark(b)) continue
    if (a.linkId !== undefined || linkKey(a) !== linkKey(b)) continue
    if (!ids.has(sb)) ids.set(sb, next++)
  }
  if (!ids.size) return
  for (const n of out) {
    const id = ids.get(state.linkSeq.get(n) ?? -1)
    if (id !== undefined) n.linkId = id
  }
}

function parseWith(src: string, ctx: Ctx, marks: Marks = {}): Inline[] {
  const out: Inline[] = []
  const state: FlattenState = { seq: 0, linkSeq: new Map() }
  flatten(pairEmphasis(tokenize(src, ctx)), [], marks, out, state)
  markLinkIdentity(out, state)
  return out
}

// Parses GitBook/GFM inline markdown into flat inlines with marks.
// Supported: **bold** / __bold__, _italic_ / *italic*, ***both***, ~~strike~~, `code`, [text](url "title"),
// [text][ref] / [text][] / [ref], <url> and bare URLs, @mention / #tag / $codebase / [^n] chips,
// ![alt](src "title"), backslash escapes, plus GitHub-style inline HTML: <img …>, <a href><img …></a>,
// <a href>text</a>.
export function parseInline(src: string, marks: Marks = {}): Inline[] {
  return parseWith(src, { defs: refDefinitions }, marks)
}

// ─── Serializing ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Definitions of the document being serialized (normalized label → url), so reference-style links whose
 * target no longer matches their definition fall back to inline links. Set by `serializeMarkdown`.
 */
let documentDefs: ReadonlyMap<string, string> | null = null

/** Run `fn` with the document's reference definitions in scope for `serializeInline`. */
export function withDocumentDefinitions<T>(defs: ReadonlyMap<string, string>, fn: () => T): T {
  const saved = documentDefs
  documentDefs = defs
  try {
    return fn()
  } finally {
    documentDefs = saved
  }
}

export function serializeReference(n: ReferenceNode): string {
  if (n.kind === "citation") return `[^${n.id}]`
  return `${KIND_SIGIL[n.kind]}${n.id}`
}

function serializeImage(n: InlineImageNode, atomicLink: boolean): string {
  const link = atomicLink ? n.link : undefined
  const alt = n.alt ?? ""
  if (n.syntax === "markdown" && !link && !alt.includes("\n") && closingBracket(`[${alt}]`, 0) === alt.length + 1) {
    // Through its definition, while that still gives this source.
    if (n.srcForm && n.srcRef !== undefined && (!documentDefs || documentDefs.get(normalizeLabel(n.srcRef)) === n.src)) {
      if (n.srcForm === "ref") return `![${alt}][${n.srcRef}]`
      const same = normalizeLabel(unescapeLabel(n.srcRef)) === normalizeLabel(unescapeLabel(alt))
      return !same ? `![${alt}][${n.srcRef}]` : n.srcForm === "collapsed" ? `![${alt}][]` : `![${alt}]`
    }
    return `![${alt}](${n.src}${n.title !== undefined ? ` "${n.title}"` : ""})`
  }
  if (n.html) {
    const said = htmlImage(n.html)
    if (
      said &&
      said.src === n.src &&
      (said.alt ?? "") === (n.alt ?? "") &&
      (said.width ?? "") === (n.width ?? "") &&
      (said.height ?? "") === (n.height ?? "") &&
      (said.link ?? "") === (link ?? "")
    ) {
      return n.html
    }
  }
  const attrs = [
    `src="${n.src}"`,
    n.alt ? `alt="${n.alt}"` : "",
    n.width ? `width="${n.width}"` : "",
    n.height ? `height="${n.height}"` : "",
  ]
    .filter(Boolean)
    .join(" ")
  const img = `<img ${attrs} />`
  return link ? `<a href="${link}">${img}</a>` : img
}

interface Entry {
  mark: Mark
  delim: InlineDelimiter
  url?: string
  title?: string
  ref?: string
  tag?: string
  tagEnd?: string
  id?: number
}

/** The inline's formatting, outermost → innermost: its `delims` hint reconciled with its actual marks. */
function entriesFor(n: Inline): Entry[] {
  const fallback = defaultDelims(n)
  let delims = fallback
  if (n.delims?.length) {
    const has = (m: Mark) => (m === "link" ? linkIsMark(n) : !!n[m])
    delims = []
    for (const d of n.delims) {
      const m = MARK_OF[d]
      if (m && has(m) && !(m === "link" && delims.some(isLinkForm))) delims.push(d)
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
        delims.splice(last && isLinkForm(last) ? delims.length - 1 : delims.length, 0, d)
      }
    }
    delims = delims.map((d, k) => validForm(n, d, k === delims.length - 1))
  }
  return delims.map((delim) => {
    if (!isLinkForm(delim)) return { mark: MARK_OF[delim], delim }
    const e: Entry = { mark: "link", delim, url: n.link }
    if (delim === "link" && n.linkTitle !== undefined) e.title = n.linkTitle
    if ((delim === "ref" || delim === "collapsed" || delim === "shortcut") && n.linkRef !== undefined) e.ref = n.linkRef
    if (delim === "html") {
      e.tag = n.linkTag
      if (n.linkTagEnd && /^<\/a\s*>$/i.test(n.linkTagEnd)) e.tagEnd = n.linkTagEnd
    }
    if (n.linkId !== undefined) e.id = n.linkId
    return e
  })
}

/** A link form the inline can still be written in, or `"link"`. */
function validForm(n: Inline, d: InlineDelimiter, innermost: boolean): InlineDelimiter {
  switch (d) {
    // An autolink shows its URL as its text: only valid innermost, around an unchanged URL.
    case "url":
    case "<>":
      return innermost && n.type === "text" && n.text === n.link && !n.code && !n.escaped ? d : "link"
    case "ref":
    case "collapsed":
    case "shortcut": {
      if (n.linkRef === undefined || (d === "ref" && !n.linkRef)) return "link"
      // The definition must still say this target.
      const defined = documentDefs?.get(normalizeLabel(n.linkRef))
      return documentDefs && defined !== n.link ? "link" : d
    }
    case "html":
      return n.linkTag ? d : "link"
    default:
      return d
  }
}

/**
 * The spelling `serializeInline` gives an inline, outermost → innermost: its `delims` hint reconciled with
 * its marks. Editors can store it per mark and hand it back as `delims`.
 */
export function inlineDelims(n: Inline): InlineDelimiter[] {
  return entriesFor(n).map((e) => e.delim)
}

/** The spelling an inline gets without a `delims` hint; a hint equal to it can be dropped. */
export function defaultInlineDelims(n: Inline): InlineDelimiter[] {
  return defaultDelims(n)
}

const sameEntry = (a: Entry, b: Entry) =>
  a.delim === b.delim && a.url === b.url && a.title === b.title && a.ref === b.ref && a.tag === b.tag && a.tagEnd === b.tagEnd && a.id === b.id

/** An HTML link's opening tag, its `href` updated if the link target changed. */
function htmlTag(e: Entry): string {
  const tag = e.tag!
  const href = tag.match(/\shref="([^"]*)"/i)
  if (!href || href[1] === e.url) return tag
  return tag.replace(/(\shref=")[^"]*(")/i, `$1${e.url}$2`)
}

function opener(e: Entry): string {
  if (e.mark !== "link") return e.delim
  if (BRACKETED.has(e.delim)) return "["
  if (e.delim === "<>") return "<"
  if (e.delim === "html") return htmlTag(e)
  return ""
}

/** `text`: the link text as written (unescaped), for the collapsed / shortcut forms whose label it is. */
function closer(e: Entry, text: string): string {
  if (e.mark !== "link") return e.delim
  switch (e.delim) {
    case "link":
      return `](${e.url}${e.title !== undefined ? ` "${e.title}"` : ""})`
    case "ref":
      return `][${e.ref}]`
    case "collapsed":
    case "shortcut": {
      // The text is the label: if it was edited, name the label explicitly.
      const same = normalizeLabel(unescapeLabel(e.ref ?? "")) === normalizeLabel(unescapeLabel(text))
      return !same ? `][${e.ref}]` : e.delim === "collapsed" ? "][]" : "]"
    }
    case "<>":
      return ">"
    case "html":
      return e.tagEnd ?? "</a>"
    default:
      return ""
  }
}

const unescapeLabel = (s: string) => s.replace(/\\([!-/:-@[-`{-~])/g, "$1")

/** The fewest backticks that can fence `t`. */
function codeSpanTicks(t: string): number {
  const runs = new Set((t.match(/`+/g) ?? []).map((r) => r.length))
  let n = 1
  while (runs.has(n)) n++
  return n
}

/** `t` as a code span: `ticks` backticks when given and usable, else the fewest that work. */
function codeSpan(t: string, ticks?: number): string {
  const runs = new Set((t.match(/`+/g) ?? []).map((r) => r.length))
  const n = ticks && ticks > 0 && !runs.has(ticks) ? ticks : codeSpanTicks(t)
  const fence = "`".repeat(n)
  const pad = t.startsWith("`") || t.endsWith("`") ? " " : ""
  return `${fence}${pad}${t}${pad}${fence}`
}

/** A piece of output: markdown syntax (verbatim) or literal text (escaped on render). */
interface Piece {
  s: string
  text?: boolean
  /** Literal text inside `[…]` link text, where unbalanced brackets must be escaped. */
  inLink?: boolean
  /** Characters the source escaped: always written with a backslash. */
  forced?: boolean
  /** Offsets (in `s`) of `|` written bare in a table cell. */
  barePipes?: number[]
  /** Opens / closes `[…]` link text. */
  linkStart?: boolean
  linkEnd?: boolean
}

/**
 * Does literal `raw[i]` need a backslash? `minimal` escapes only what would otherwise parse as syntax —
 * judged against the whole rendered line, so snake_case, `2 * 3`, `~5 min` and `a [b] c` stay as written.
 */
function needsEscape(r: RenderInput, i: number, minimal: boolean, defs: ReadonlyMap<string, string>) {
  const { raw, text, bracket } = r
  const c = raw[i]
  switch (c) {
    case "\\":
      // A backslash ending the line (a hard break) stays as it is.
      return !minimal || (i + 1 < raw.length && ASCII_PUNCT.test(raw[i + 1]))
    case "`":
      return true
    case "[": {
      if (!minimal || bracket[i] === 1 || raw[i + 1] === "^") return true
      if (/^\[(?:\\.|[^\]\\])*\][([]/.test(raw.slice(i))) return true
      // `[label]` that a definition would turn into a shortcut link
      const close = closingBracket(raw, i)
      return close !== -1 && defs.has(normalizeLabel(raw.slice(i + 1, close)))
    }
    case "]":
      return !minimal || bracket[i] === 1
    case "@":
    case "#":
    case "$":
      // Only at a chip boundary, so emails / C# / $5 survive untouched — and not before an escaped character.
      return isReferenceBoundary(raw[i - 1]) && /[A-Za-z_]/.test(raw[i + 1] ?? "") && !r.forced[i + 1]
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

interface RenderInput {
  raw: string
  /** 1 where the character is literal text. */
  text: Uint8Array
  /** 1 where a literal bracket inside link text is unbalanced (so it must be escaped). */
  bracket: Uint8Array
  /** 1 where the source escaped the character. */
  forced: Uint8Array
  /** 1 where a `|` stays bare in a table cell. */
  bare: Uint8Array
}

/** The rendered line: its characters, and which literal ones get a backslash. */
interface Rendering extends RenderInput {
  escape: Uint8Array
}

function layout(pieces: Piece[]): RenderInput {
  const raw = pieces.map((p) => p.s).join("")
  const text = new Uint8Array(raw.length)
  const bracket = new Uint8Array(raw.length)
  const forced = new Uint8Array(raw.length)
  const bare = new Uint8Array(raw.length)
  let at = 0
  // Brackets in link text must balance, or the link text ends early: escape the ones that don't.
  let linkOpen: number[] | null = null
  for (const p of pieces) {
    if (p.linkStart) linkOpen = []
    if (p.text) text.fill(1, at, at + p.s.length)
    if (p.forced) {
      for (let k = 0; k < p.s.length; k++) if (ASCII_PUNCT.test(p.s[k])) forced[at + k] = 1
    }
    for (const k of p.barePipes ?? []) bare[at + k] = 1
    if (linkOpen && p.text && !p.forced) {
      for (let k = 0; k < p.s.length; k++) {
        if (p.s[k] === "[") linkOpen.push(at + k)
        else if (p.s[k] === "]") {
          if (linkOpen.length) linkOpen.pop()
          else bracket[at + k] = 1
        }
      }
    }
    if (p.linkEnd && linkOpen) {
      for (const k of linkOpen) bracket[k] = 1
      linkOpen = null
    }
    at += p.s.length
  }
  return { raw, text, bracket, forced, bare }
}

function render(input: RenderInput, minimal: boolean, defs: ReadonlyMap<string, string>): Rendering {
  const { raw, text, forced } = input
  const escape = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) {
    if (forced[i]) escape[i] = 1
    else if (text[i] && /[\\`*_~[\]@#$]/.test(raw[i]) && needsEscape(input, i, minimal, defs)) escape[i] = 1
  }
  return { ...input, escape }
}

/** The written line; `table`: inside a GFM table cell, where pipes are escaped unless written bare. */
const written = ({ raw, escape, bare }: Rendering, table = false) => {
  let out = ""
  for (let i = 0; i < raw.length; i++) {
    if (escape[i]) out += `\\${raw[i]}`
    else if (table && raw[i] === "|" && !bare[i]) out += "\\|"
    else out += raw[i]
  }
  return out
}

/**
 * Drop backslashes the line can do without — `footnote*`, a lone backtick, `[x]` before a `(` that isn't a
 * link. An escaped run is dropped only if the line still means `want` with every escaped run of the same
 * character unescaped too, so paired escapes (`\*x\*`, `` \`x\` ``) keep both backslashes. The source's own
 * escapes are never dropped.
 */
function relax(r: Rendering, want: string, ctx: Ctx): Rendering {
  const groups: Array<{ start: number; end: number; ch: string }> = []
  for (let i = 0; i < r.raw.length; i++) {
    const ch = r.raw[i]
    if (!r.escape[i] || r.forced[i] || !/[`*_~[]/.test(ch)) continue
    let end = i + 1
    if (ch !== "`" && ch !== "[") while (r.escape[end] && !r.forced[end] && r.raw[end] === ch) end++
    groups.push({ start: i, end, ch })
    i = end - 1
  }
  if (!groups.length || groups.length > 32) return r
  const without = (drop: (g: (typeof groups)[number]) => boolean): Rendering => {
    const escape = r.escape.slice()
    for (const g of groups) if (drop(g)) escape.fill(0, g.start, g.end)
    return { ...r, escape }
  }
  const droppable = new Set(groups.filter((g) => meaning(parseWith(written(without((o) => o.ch === g.ch)), ctx)) === want))
  if (!droppable.size) return r
  const relaxed = without((g) => droppable.has(g))
  return meaning(parseWith(written(relaxed), ctx)) === want ? relaxed : r
}

const marksKey = (n: Inline) => [!!n.bold, !!n.italic, !!n.strike, linkIsMark(n) ? n.link : ""]

/** What a line means, ignoring spelling: merged text runs with their marks, plus atoms with theirs. */
function meaning(nodes: Inline[]): string {
  const parts: unknown[] = []
  let last: { key: string; text: string } | undefined
  for (const n of nodes) {
    if (n.type !== "text") {
      last = undefined
      parts.push(
        n.type === "image"
          ? ["img", n.src, linkIsMark(n) ? "" : (n.link ?? ""), ...marksKey(n)]
          : ["ref", n.kind, n.id, ...marksKey(n)],
      )
      continue
    }
    if (!n.text) continue
    const key = JSON.stringify([...marksKey(n), !!n.code])
    if (last && last.key === key && !n.code) last.text += n.text
    else parts.push((last = { key, text: n.text }))
  }
  return JSON.stringify(parts)
}

export interface SerializeInlineOptions {
  /** Inside a GFM table cell: pipes are written `\|` (except those a code span recorded as bare). */
  tableCell?: boolean
}

// Serializes inline nodes back to markdown, as written: each inline's `delims` restores the author's markers,
// nesting and link form, and formatting shared by adjacent inlines (chips and images included) is opened once
// — `**bold [link](url) inside**`, `**ask @brett**` and `[**a** b](url)` come back whole instead of per run.
// Text is escaped minimally (plus every escape the source wrote); if the minimal form would parse back
// differently, everything escapable is escaped instead.
export function serializeInline(nodes: Inline[], options: SerializeInlineOptions = {}): string {
  const pieces: Piece[] = []
  const open: Array<Entry & { start: number }> = []
  // Reference forms resolve through definitions: the document's, else the ones the links themselves imply.
  const defs = new Map(documentDefs ?? [])
  const closeTo = (depth: number) => {
    while (open.length > depth) {
      const e = open.pop()!
      const text = pieces.slice(e.start + 1).map((p) => p.s).join("")
      pieces.push({ s: closer(e, text), ...(BRACKETED.has(e.delim) ? { linkEnd: true } : {}) })
    }
  }
  for (const n of nodes) {
    if (n.type === "text" && !n.text && !linkIsMark(n)) continue
    const wanted = entriesFor(n)
    for (const e of wanted) {
      if (e.ref !== undefined && e.url !== undefined && !defs.has(normalizeLabel(e.ref))) defs.set(normalizeLabel(e.ref), e.url)
    }
    if (n.type === "image" && n.srcRef !== undefined && !defs.has(normalizeLabel(n.srcRef))) defs.set(normalizeLabel(n.srcRef), n.src)
    // Keep the open formatting this inline still wants (outermost first), close the rest, open what's missing.
    const missing = [...wanted]
    let keep = 0
    for (; keep < open.length; keep++) {
      const k = missing.findIndex((w) => sameEntry(w, open[keep]))
      if (k < 0) break
      missing.splice(k, 1)
    }
    closeTo(keep)
    for (const w of missing) {
      open.push({ ...w, start: pieces.length })
      pieces.push({ s: opener(w), ...(BRACKETED.has(w.delim) ? { linkStart: true } : {}) })
    }
    const inLink = open.some((e) => BRACKETED.has(e.delim))
    const innermost = open[open.length - 1]
    if (n.type === "image") pieces.push({ s: serializeImage(n, !linkIsMark(n)) })
    else if (n.type === "reference") pieces.push({ s: serializeReference(n) })
    else if (n.code) {
      const s = codeSpan(n.text, n.ticks)
      const pad = s.indexOf(n.text)
      pieces.push({ s, ...(n.barePipes?.length ? { barePipes: n.barePipes.map((k) => k + pad) } : {}) })
    } else if (n.escaped) pieces.push({ s: n.text, text: true, forced: true, inLink })
    else if (innermost?.mark === "link" && (innermost.delim === "url" || innermost.delim === "<>")) pieces.push({ s: n.text }) // autolink
    else pieces.push({ s: n.text, text: true, inLink })
  }
  closeTo(0)

  const ctx: Ctx = { defs }
  const table = !!options.tableCell
  const input = layout(pieces)
  const minimal = render(input, true, defs)
  if (!pieces.some((p) => p.text)) return written(minimal, table)
  const want = meaning(nodes)
  if (meaning(parseWith(written(minimal), ctx)) === want) return written(relax(minimal, want, ctx), table)
  const full = render(input, false, defs)
  return meaning(parseWith(written(full), ctx)) === want ? written(full, table) : written(minimal, table)
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
