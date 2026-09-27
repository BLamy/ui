import type { Inline, InlineImageNode, ReferenceNode, TextNode } from "./ast"

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
// Chips are only recognized at start-of-input or after whitespace/open brackets,
// so brett@replay.io and C# stay plain text.
const isReferenceBoundary = (prev: string | undefined) =>
  prev === undefined || /[\s([{]/.test(prev)

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

// Parses GitBook/GFM inline markdown into flat TextNodes with marks.
// Supported: **bold**, _italic_ / *italic*, ~~strike~~, `code`, [text](url),
// plus GitHub-style inline HTML: <img …>, <a href><img …></a>, <a href>text</a>.
export function parseInline(src: string, marks: Marks = {}): Inline[] {
  const out: Inline[] = []
  let buf = ""

  const flush = () => {
    if (buf) {
      out.push({ type: "text", text: buf, ...marks })
      buf = ""
    }
  }

  let i = 0
  while (i < src.length) {
    const rest = src.slice(i)

    if (rest.startsWith("\\") && rest.length > 1) {
      buf += rest[1]
      i += 2
      continue
    }

    // inline code: no nested marks inside
    if (rest[0] === "`") {
      const end = src.indexOf("`", i + 1)
      if (end !== -1) {
        flush()
        out.push({ type: "text", text: src.slice(i + 1, end), ...marks, code: true })
        i = end + 1
        continue
      }
    }

    // <a href="…"><img …></a> — linked image (GitHub badge style)
    const linkedImg = rest.match(/^<a\s[^>]*href="([^"]*)"[^>]*>\s*<img\s([^>]*?)\/?>\s*<\/a>/i)
    if (linkedImg) {
      flush()
      out.push({ type: "image", ...imgAttrs(linkedImg[2]), link: linkedImg[1] })
      i += linkedImg[0].length
      continue
    }

    // <img …> — bare inline image
    const htmlImg = rest.match(/^<img\s([^>]*?)\/?>/i)
    if (htmlImg) {
      flush()
      out.push({ type: "image", ...imgAttrs(htmlImg[1]) })
      i += htmlImg[0].length
      continue
    }

    // <a href="…">text</a> — html link
    const htmlLink = rest.match(/^<a\s[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/i)
    if (htmlLink) {
      flush()
      out.push(...parseInline(htmlLink[2], { ...marks, link: htmlLink[1] }))
      i += htmlLink[0].length
      continue
    }

    // ![alt](src) — markdown inline image
    const mdImg = rest.match(/^!\[([^\]]*)\]\(([^)\s]+)\)/)
    if (mdImg) {
      flush()
      out.push({ type: "image", src: mdImg[2], ...(mdImg[1] ? { alt: mdImg[1] } : {}) })
      i += mdImg[0].length
      continue
    }

    const delims: Array<[string, Marks]> = [
      ["**", { bold: true }],
      ["~~", { strike: true }],
      ["*", { italic: true }],
      ["_", { italic: true }],
    ]
    let matched = false
    for (const [d, mark] of delims) {
      if (rest.startsWith(d)) {
        const end = src.indexOf(d, i + d.length)
        if (end > i + d.length - 1 && end !== -1 && src.slice(i + d.length, end).length > 0) {
          flush()
          out.push(...parseInline(src.slice(i + d.length, end), { ...marks, ...mark }))
          i = end + d.length
          matched = true
          break
        }
      }
    }
    if (matched) continue

    // [^id] — footnote citation marker (must precede [text](url) / [text][ref])
    const cite = rest.match(/^\[\^([^\]\s]+)\]/)
    if (cite) {
      flush()
      const def = footnoteDefinitions.get(cite[1])
      out.push({ type: "reference", kind: "citation", id: cite[1], ...def })
      i += cite[0].length
      continue
    }

    // @mention / #tag / $codebase chips, only at a word boundary
    if ((rest[0] === "@" || rest[0] === "#" || rest[0] === "$") && isReferenceBoundary(src[i - 1])) {
      const m = rest.match(rest[0] === "$" ? CODEBASE_BODY_RE : REFERENCE_BODY_RE)
      if (m) {
        const id = m[1].replace(/[./-]+$/, "")
        if (id) {
          flush()
          out.push({ type: "reference", kind: SIGIL_KIND[rest[0] as "@" | "#" | "$"], id })
          i += 1 + id.length
          continue
        }
      }
    }

    // [text](url)
    if (rest[0] === "[") {
      const m = rest.match(/^\[([^\]]*)\]\(([^)\s]+)\)/)
      if (m) {
        flush()
        const inner = marks.bold || marks.italic || marks.strike ? { linkInner: true as const } : {}
        out.push(...parseInline(m[1], { ...marks, link: m[2], ...inner }))
        i += m[0].length
        continue
      }
      // [text][ref] / [text][] — reference-style links
      const ref = rest.match(/^\[([^\]]*)\]\[([^\]]*)\]/)
      if (ref) {
        const key = (ref[2] || ref[1]).toLowerCase()
        const url = refDefinitions.get(key)
        if (url) {
          flush()
          out.push(...parseInline(ref[1], { ...marks, link: url }))
          i += ref[0].length
          continue
        }
      }
    }

    // <https://…> — angle-bracket autolink
    const angleLink = rest.match(/^<(https?:\/\/[^>\s]+)>/i)
    if (angleLink) {
      flush()
      out.push({ type: "text", text: angleLink[1], ...marks, link: angleLink[1] })
      i += angleLink[0].length
      continue
    }

    // bare URL autolink (GFM) — at start or after whitespace
    if (
      /^https?:\/\//i.test(rest) &&
      (buf === "" || /\s$/.test(buf))
    ) {
      const m = rest.match(/^https?:\/\/[^\s<>"')\]]+/i)!
      const url = m[0].replace(/[.,;:!?]+$/, "")
      flush()
      out.push({ type: "text", text: url, ...marks, link: url })
      i += url.length
      continue
    }

    buf += src[i]
    i++
  }
  flush()
  return out
}

const escapeText = (t: string) =>
  t
    .replace(/([*_~`[\]\\])/g, "\\$1")
    // Escape @/#/$ only at a chip boundary so emails/C#/$5 survive untouched.
    // Note: node-local — a boundary formed across adjacent inline nodes
    // (previous node ending in whitespace) is not caught; rare, accepted.
    .replace(/(^|[\s([{])([@#$])(?=[A-Za-z_])/g, "$1\\$2")

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

// Serializes inline nodes back to markdown. Emphasis (bold / italic / strike) is kept open across
// adjacent runs that share it, so `**bold [link](url) inside**` — three runs under one bold — comes back
// as written instead of `**bold ****[link](url)**** inside**`.
type Emphasis = "strike" | "italic" | "bold"
const EMPHASIS: Emphasis[] = ["strike", "italic", "bold"] // outermost → innermost
const MARKER: Record<Emphasis, string> = { strike: "~~", italic: "_", bold: "**" }

function textBody(n: TextNode): string {
  const s = n.code ? n.text : escapeText(n.text)
  return n.code ? `\`${s}\`` : s
}

export function serializeInline(nodes: Inline[]): string {
  let out = ""
  const open: Emphasis[] = []
  const closeTo = (depth: number) => {
    while (open.length > depth) out += MARKER[open.pop()!]
  }
  for (const n of nodes) {
    if (n.type !== "text") {
      closeTo(0)
      out += n.type === "image" ? serializeImage(n) : serializeReference(n)
      continue
    }
    // bare autolink: text identical to the URL, no other marks
    if (n.link && n.text === n.link && !n.bold && !n.italic && !n.strike && !n.code) {
      closeTo(0)
      out += n.link
      continue
    }
    const wanted = EMPHASIS.filter((m) => n[m])
    // A link around its emphasis (`[**x**](url)`) is self-contained: close everything, wrap this run alone.
    if (n.link && !(n.linkInner && wanted.length)) {
      closeTo(0)
      let s = textBody(n)
      for (const m of [...wanted].reverse()) s = `${MARKER[m]}${s}${MARKER[m]}`
      out += `[${s}](${n.link})`
      continue
    }
    // Keep the longest prefix of open marks this run still wants, close the rest, open what's missing.
    let keep = 0
    while (keep < open.length && wanted.includes(open[keep])) keep++
    closeTo(keep)
    for (const m of wanted) if (!open.includes(m)) { open.push(m); out += MARKER[m] }
    out += n.link ? `[${textBody(n)}](${n.link})` : textBody(n)
  }
  closeTo(0)
  return out
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
