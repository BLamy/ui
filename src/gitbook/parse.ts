import type {
  Block,
  CodeBlockNode,
  ColumnNode,
  CommandNode,
  DemoInlineFile,
  DemoLayout,
  DemoNode,
  DemoVariantOption,
  DemoViewport,
  DocumentNode,
  DefinitionNode,
  FigureNode,
  HintStyle,
  ListNode,
  ParagraphNode,
  Inline,
  ListItemNode,
  BlockSpacing,
  BlockquoteNode,
  ContainerSpacing,
  EmbedNode,
  ExpandableNode,
  HintNode,
  SourceRefNode,
  StepperNode,
  ColumnsNode,
  TabsNode,
  UpdatesNode,
  StepNode,
  TableNode,
  TabNode,
  TextNode,
  UpdateNode,
} from "./ast"
import { TAG_ATTRS, parseAttrs } from "./attrs"
import { containerTags, defaultDelimiterRow, definitionLine, delimiterAlign, fenceInfo, figureMarkdown, serializeBlocks, type TaggedNode } from "./serialize"
import { footnoteDefinitions, normalizeLabel, parseInline, plainText, refDefinitions } from "./inline"

// Minimal HTML-inline → markdown-inline bridge for HTML table cells.
function htmlToInlineMd(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<strong>(.*?)<\/strong>/gis, "**$1**")
    .replace(/<b>(.*?)<\/b>/gis, "**$1**")
    .replace(/<em>(.*?)<\/em>/gis, "_$1_")
    .replace(/<i>(.*?)<\/i>/gis, "_$1_")
    .replace(/<code>(.*?)<\/code>/gis, "`$1`")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gis, "[$2]($1)")
    .replace(/<[^>]+>/g, "")
    .trim()
}

/** Stands in for a pipe written bare inside a table cell's code span, until the cell is parsed. */
const BARE_PIPE = "\uE000"

/** A table cell's inlines: pipes a code span wrote bare are remembered on the run (`barePipes`). */
function parseCell(cell: string): Inline[] {
  const nodes = parseInline(cell)
  if (!cell.includes(BARE_PIPE)) return nodes
  for (const n of nodes) {
    if (n.type !== "text" || !n.text.includes(BARE_PIPE)) continue
    if (n.code) {
      const bare: number[] = []
      for (let k = 0; k < n.text.length; k++) if (n.text[k] === BARE_PIPE) bare.push(k)
      ;(n as TextNode).barePipes = bare
    }
    n.text = n.text.split(BARE_PIPE).join("|")
  }
  return nodes
}

// Split a GFM pipe-table row into cell strings. Splits only on unescaped pipes
// that are outside inline-code spans, and unescapes "\|" back to a literal "|".
function splitTableRow(row: string): string[] {
  const trimmed = row.trim().replace(/^\|/, "").replace(/\|$/, "")
  const cells: string[] = []
  let cur = ""
  for (let k = 0; k < trimmed.length; k++) {
    const ch = trimmed[k]
    if (ch === "\\") {
      // `\|` is a literal pipe (in code spans too); any other escape passes through for the inline parser.
      cur += trimmed[k + 1] === "|" ? "|" : trimmed.slice(k, k + 2)
      k++
      continue
    }
    if (ch === "`") {
      // A code span (a backtick run closed by one of the same length) keeps its pipes; a lone run is literal.
      let n = 1
      while (trimmed[k + n] === "`") n++
      const fence = "`".repeat(n)
      let end = trimmed.indexOf(fence, k + n)
      while (end !== -1 && (trimmed[end + n] === "`" || trimmed[end - 1] === "`")) {
        let e = end
        while (trimmed[e] === "`") e++
        end = trimmed.indexOf(fence, e)
      }
      const stop = end === -1 ? k + n : end + n
      // `\|` is a pipe; a bare one is marked so the cell can remember it was written bare.
      cur += trimmed.slice(k, stop).replace(/\\\||\|/g, (m) => (m === "|" ? BARE_PIPE : "|"))
      k = stop - 1
      continue
    }
    if (ch === "|") {
      cells.push(cur)
      cur = ""
      continue
    }
    cur += ch
  }
  cells.push(cur)
  return cells
}

const TEMPLATE_RE = new RegExp(String.raw`^\s*\{%\s*(\S+?)(\s+${TAG_ATTRS})?\s*%\}\s*$`)

function booleanAttr(attrs: Record<string, string>, key: string): boolean | undefined {
  if (!(key in attrs)) return undefined
  return attrs[key] !== "false"
}

/**
 * A fence's line numbers: `lineNumbers` / `showLineNumbers` when written (remembered as
 * explicit so the attribute round-trips even when it equals the default), otherwise on for
 * titled (file) fences and off for untitled ones.
 */
function lineNumbersFrom(attrs: Record<string, string>, titled: boolean): Pick<CodeBlockNode, "lineNumbers" | "lineNumbersExplicit"> {
  const written = booleanAttr(attrs, "lineNumbers") ?? booleanAttr(attrs, "showLineNumbers")
  return written === undefined ? { lineNumbers: titled } : { lineNumbers: written, lineNumbersExplicit: true }
}

function positiveNumberAttr(attrs: Record<string, string>, key: string): number | undefined {
  if (!(key in attrs)) return undefined
  const value = Number(attrs[key])
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : undefined
}

interface TemplateTag {
  name: string
  attrs: Record<string, string>
}

function templateTag(line: string): TemplateTag | null {
  const m = line.match(TEMPLATE_RE)
  if (!m) return null
  return { name: m[1], attrs: parseAttrs(m[2]) }
}

interface Fence {
  char: "`" | "~"
  length: number
}

/** A fence opener (```` ```ts title="x" ```` or `~~~`), or null. Backtick info strings cannot contain backticks. */
export function fenceOpener(line: string): Fence | null {
  const m = line.match(/^\s*(`{3,}|~{3,})(.*)$/)
  if (!m) return null
  if (m[1][0] === "`" && m[2].includes("`")) return null
  return { char: m[1][0] as Fence["char"], length: m[1].length }
}

/** True when `line` closes `fence`: the same character, at least as many, nothing else. */
export function closesFence(line: string, fence: Fence): boolean {
  const trimmed = line.trim()
  return trimmed.length >= fence.length && trimmed === fence.char.repeat(trimmed.length)
}

/** Tracks whether a line-by-line scan is inside a fenced code block. */
export function fenceTracker() {
  let open: Fence | null = null
  return {
    /** Feed the next line; returns true if the line is fence content or a fence delimiter. */
    step(line: string): boolean {
      if (open) {
        if (closesFence(line, open)) open = null
        return true
      }
      open = fenceOpener(line)
      return open !== null
    },
    get inside() {
      return open !== null
    },
  }
}

// Collects the lines between an opening {% name %} and its matching
// {% endname %}, honoring nesting of the same tag. Tags inside fenced code
// (a demo file, a Markdown sample) are content, not structure.
function collectUntil(lines: string[], start: number, name: string): { body: string[]; next: number; closing?: string } {
  const body: string[] = []
  let depth = 1
  let i = start
  const fences = fenceTracker()
  for (; i < lines.length; i++) {
    if (fences.step(lines[i])) {
      body.push(lines[i])
      continue
    }
    const tag = templateTag(lines[i])
    if (tag?.name === name) depth++
    if (tag?.name === `end${name}`) {
      depth--
      if (depth === 0) return { body, next: i + 1, closing: lines[i] }
    }
    body.push(lines[i])
  }
  return { body, next: i }
}

/** Records a container's opening / closing tag lines where they aren't what serialization writes. */
function tagged<T extends TaggedNode>(node: T, opening: string, closing: string | undefined): T {
  const [open, close] = containerTags(node)
  if (opening !== open) node.opening = opening
  if ((closing ?? "") !== close) node.closing = closing ?? ""
  return node
}

function collectHtmlUntil(lines: string[], start: number, closeTag: string): { body: string[]; next: number; closing?: string } {
  const body: string[] = []
  let i = start
  for (; i < lines.length; i++) {
    if (lines[i].includes(closeTag)) {
      const before = lines[i].slice(0, lines[i].indexOf(closeTag))
      if (before.trim()) body.push(before)
      return { body, next: i + 1, ...(before.trim() ? {} : { closing: lines[i] }) }
    }
    body.push(lines[i])
  }
  return { body, next: i }
}

const HINT_STYLES: HintStyle[] = ["info", "success", "warning", "danger"]

/** `![alt](src "title")` alone on its line. */
const SOLO_IMG_RE = /^!\[([^\]]*)\]\(([^)\s]+)(?:[ \t]+"([^"]*)")?\)$/

/** Keeps the figure's source lines, unless they are exactly what serialization writes anyway. */
function withRaw(figure: FigureNode, raw: string): FigureNode {
  if (raw !== figureMarkdown(figure)) figure.raw = raw
  return figure
}



/** `[^id]: url "Label"` — a footnote citation definition. */
const FOOTNOTE_DEF_RE = /^\[\^([^\]\s]+)\]:\s*(\S+)(?:\s+"([^"]*)")?\s*$/
/** `[label]: url "title"` — a reference-style link definition (up to three spaces of indent). */
const REF_DEF_RE = /^ {0,3}\[((?:\\.|[^\]\\])+)\]:[ \t]*(\S+)(?:[ \t]+"((?:\\.|[^"\\])*)")?[ \t]*$/

/** The canonical line for a footnote definition. */
export function footnoteLine(id: string, url: string, label?: string): string {
  return `[^${id}]: ${url}${label ? ` "${label}"` : ""}`
}

export function parseMarkdown(src: string): DocumentNode {
  // Windows line endings throughout come back as such; mixed ones stay in the lines as written.
  const crlf = src.includes("\r\n") && !/(^|[^\r])\n/.test(src)
  const lines = src.split(crlf || !src.includes("\r\n") ? /\r?\n/ : "\n")
  refDefinitions.clear()
  footnoteDefinitions.clear()
  const fences = fenceTracker()
  // Canonical footnote definitions (outside fences), by line.
  const canonicalFoot: boolean[] = []
  lines.forEach((line, k) => {
    // Definition lines inside code fences are content, not definitions.
    if (fences.step(line)) return
    // Footnote citation definitions first: [^id]: url "Optional Label"
    const foot = line.match(FOOTNOTE_DEF_RE)
    if (foot) {
      footnoteDefinitions.set(foot[1], { url: foot[2], ...(foot[3] ? { label: foot[3] } : {}) })
      canonicalFoot[k] = line === footnoteLine(foot[1], foot[2], foot[3])
      return
    }
    const def = line.match(REF_DEF_RE)
    // Keys starting with ^ are reserved for footnotes and must never
    // shadow reference-style link definitions. The first definition of a label wins.
    if (def && !def[1].startsWith("^")) {
      const key = normalizeLabel(def[1])
      if (!refDefinitions.has(key)) refDefinitions.set(key, def[2])
    }
  })
  // The footnote definitions ending the document are its doc-level `citations`, written back as a group;
  // any others stay where they are, as definition blocks.
  let last = lines.length - 1
  while (last >= 0 && !lines[last].trim()) last--
  let group = last + 1
  while (group > 0 && canonicalFoot[group - 1]) group--
  const trailing = group <= last
  const { blocks, end } = parseBody(trailing ? lines.slice(0, group) : lines)
  const doc: DocumentNode = { type: "doc", children: blocks }
  if (footnoteDefinitions.size) {
    doc.citations = [...footnoteDefinitions.entries()].map(([id, d]) => ({ id, ...d }))
  }
  if (trailing && end !== (blocks.length ? 1 : 0)) doc.citationsGap = end
  const ending = crlf ? src.match(/\s*$/)![0].replace(/\r\n/g, "\n") : src.match(/\s*$/)![0]
  if (crlf) doc.lineEnding = "\r\n"
  // A missing final newline is added; anything else after the last line is kept.
  if (ending !== "\n" && ending !== "") doc.end = ending
  return doc
}

const DEMO_LAYOUTS: DemoLayout[] = ["auto", "single", "multi"]
const DEMO_VIEWPORTS: DemoViewport[] = ["desktop", "tablet", "phone"]

/** `"full:Full,compact:Compact"` → `[{ id: "full", label: "Full" }, …]`. A bare id is its own label. */
export function parseDemoVariants(raw: string): DemoVariantOption[] {
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const colon = part.indexOf(":")
      if (colon < 0) return { id: part, label: part }
      const id = part.slice(0, colon).trim()
      const label = part.slice(colon + 1).trim()
      return { id, label: label || id }
    })
    .filter((v) => v.id)
}

/** `{% command %}npm install x{% endcommand %}` on one line. */
const COMMAND_ONE_LINE_RE = new RegExp(String.raw`^\s*\{%\s*command(\s${TAG_ATTRS})?\s*%\}(.*?)\{%\s*endcommand\s*%\}\s*$`)

function commandNode(attrs: Record<string, string>, raw: string): CommandNode {
  const overrides: NonNullable<CommandNode["overrides"]> = {}
  for (const pm of ["pnpm", "yarn", "bun"] as const) if (attrs[pm]) overrides[pm] = attrs[pm]
  return {
    type: "command",
    command: raw.replace(/^(?:[ \t]*\n)+/, "").replace(/(?:\n[ \t]*)+$/, "").trim(),
    ...(Object.keys(overrides).length ? { overrides } : {}),
    ...(attrs.sync && attrs.sync !== "pm" ? { sync: attrs.sync } : {}),
  }
}

const ENDDEMO_RE = /^\s*\{%\s*enddemo\s*%\}\s*$/

interface DemoBody {
  files: DemoInlineFile[]
  /** First line after the block. */
  next: number
  /** The input ended before `{% enddemo %}` (a block still streaming in). */
  open: boolean
}

function fallbackPath(index: number, language: string | undefined): string {
  const ext = language || "txt"
  return index === 0 ? `index.${ext}` : `file-${index + 1}.${ext}`
}

/**
 * The inline files of a `{% demo %}` block starting at `start` (the line after the tag).
 *
 * - `{% enddemo %}` right away: an empty block.
 * - A fence right away: the block form. Fences (and blank lines) are files until
 *   `{% enddemo %}`; any other line ends the block too. Reaching the end of input
 *   first marks the block `open` (still streaming).
 * - Blank lines, then fences: the block form only if `{% enddemo %}` closes it with
 *   nothing but fences in between — otherwise the tag is self-closing and the fences
 *   are ordinary code blocks, exactly as before 1.2.
 * - Anything else: no body (self-closing tag).
 */
export function demoBody(lines: string[], start: number, selfClosing = false): DemoBody | null {
  let j = start
  if (j < lines.length && ENDDEMO_RE.test(lines[j])) return { files: [], next: j + 1, open: false }
  // `{% demo … /%}` takes no files (a directly following `{% enddemo %}` is tolerated above).
  if (selfClosing) return null
  const immediate = j < lines.length && fenceOpener(lines[j]) !== null
  if (!immediate) {
    while (j < lines.length && !lines[j].trim()) j++
    if (j >= lines.length) return null
    if (ENDDEMO_RE.test(lines[j])) return { files: [], next: j + 1, open: false }
    if (!fenceOpener(lines[j])) return null
  }
  const files: DemoInlineFile[] = []
  while (j < lines.length) {
    const line = lines[j]
    if (!line.trim()) {
      j++
      continue
    }
    if (ENDDEMO_RE.test(line)) return { files, next: j + 1, open: false }
    const fence = fenceOpener(line)
    if (!fence) return immediate ? { files, next: j, open: false } : null
    const info = line.trim().slice(fence.length).trim()
    // `tsx title="index.tsx"` or just `title="index.tsx"` (no language).
    const first = info.match(/^[^\s`]*/)?.[0] ?? ""
    const language = first.includes("=") ? "" : first
    const rest = language ? info.slice(language.length) : info
    const attrs = parseAttrs(rest)
    const content: string[] = []
    j++
    let closed = false
    while (j < lines.length) {
      if (closesFence(lines[j], fence)) {
        closed = true
        j++
        break
      }
      content.push(lines[j])
      j++
    }
    files.push({
      path: (attrs.title ?? "").trim() || fallbackPath(files.length, language || undefined),
      content: content.join("\n"),
      ...(language ? { language } : {}),
    })
    if (!closed) break
  }
  return immediate ? { files, next: j, open: true } : null
}

function parseDemoTag(attrs: Record<string, string>): DemoNode {
  const variants = attrs.variants ? parseDemoVariants(attrs.variants) : []
  return {
    type: "demo",
    src: (attrs.src ?? "").trim(),
    ...(attrs.title ? { title: attrs.title } : {}),
    ...(attrs.description ? { description: attrs.description } : {}),
    ...(attrs.height ? { height: attrs.height } : {}),
    ...((DEMO_LAYOUTS as string[]).includes(attrs.layout) ? { layout: attrs.layout as DemoLayout } : {}),
    ...(variants.length ? { variants } : {}),
    ...((DEMO_VIEWPORTS as string[]).includes(attrs.viewport) ? { viewport: attrs.viewport as DemoViewport } : {}),
    ...(attrs.entry ? { entry: attrs.entry } : {}),
    ...(attrs.status ? { status: attrs.status } : {}),
    ...(booleanAttr(attrs, "bleed") === undefined ? {} : { bleed: booleanAttr(attrs, "bleed") }),
    ...(attrs.className ? { className: attrs.className } : {}),
    ...(attrs.surface?.trim() ? { surface: attrs.surface } : {}),
    ...(attrs.variantsWidth ? { variantsWidth: attrs.variantsWidth } : {}),
  }
}

// Strips an in-progress inline token (`[^1`, `@bre`, a lone `#`, a trailing
// `\`) from the end of a partially streamed document so chips don't flash as
// plain text mid-stream. No-op inside an unterminated code fence.
export function trimPartialInlineToken(md: string): string {
  const fences = md.match(/^\s*(?:```|~~~)/gm)
  if (fences && fences.length % 2 === 1) return md
  return md
    // A block tag still arriving (`{% demo src="butt`) would flash as a paragraph.
    .replace(/(^|\n)[ \t]*\{(?:%(?:(?!%\})[^\n])*)?$/, "$1")
    // A one-line command still arriving (`{% command %}npm i x{% endcomm`): hold the line back
    // until it closes. (The multi-line form, `{% command %}` alone on its line, renders as it grows.)
    .replace(/(^|\n)[ \t]*\{%\s*command\b[^\n]*?%\}[ \t]*\S[^\n]*$/, (line: string, lead: string) =>
      /\{%\s*endcommand\s*%\}\s*$/.test(line) ? line : lead)
    // A fence still arriving (a lone ` or ``) would end a demo block and flash as text.
    .replace(/(^|\n)[ \t]*(?:`{1,2}|~{1,2})$/, "$1")
    .replace(/\[\^[^\]]*$/, "")
    .replace(/(^|[\s([{])[@#][\w.-]*$/, "$1")
    .replace(/\\$/, "")
}

export function parseBlocks(lines: string[]): Block[] {
  return parseBody(lines).blocks
}

/** Records `gap` on a block (or item) when it differs from the default. */
function spaced<T extends BlockSpacing>(node: T, gap: number, fallback: number): T {
  if (gap !== fallback) node.gap = gap
  return node
}

/** Records `gapEnd` on a container when it differs from the default. */
function ended<T>(node: T & ContainerSpacing, end: number, fallback = 0): T {
  if (end !== fallback) node.gapEnd = end
  return node
}

/**
 * Blocks of `lines`, with the blank lines before each (`gap`, where not the default: `firstGap` before the
 * first, 1 between siblings) and the number of blank lines after the last (`end`).
 */
function parseBody(lines: string[], firstGap = 0): { blocks: Block[]; end: number } {
  const blocks: Block[] = []
  let i = 0
  // Blank lines since the last block, and before the block starting on the current line.
  let blank = 0
  let gapHere = 0
  let paragraphGap = 0
  // The blank lines themselves, for whitespace-only ones.
  let blankLines: string[] = []
  let gapLines: string[] = []
  let paragraphLines: string[] = []
  const add = (b: Block, gap = gapHere, written = gapLines) => {
    if (written.some((l) => l)) b.blanks = [...written]
    blocks.push(spaced(b, gap, blocks.length ? 1 : firstGap))
  }
  const container = <T extends Block & { gapEnd?: number }>(node: T, body: string[], build: (children: Block[]) => void, first = 0, last = 0) => {
    const parsed = parseBody(body, first)
    build(parsed.blocks)
    add(ended(node, parsed.end, last))
  }

  /** Keeps the last block's source lines as `raw` when they aren't what serialization writes. */
  const keepRaw = (from: number, to: number) => {
    const b = blocks[blocks.length - 1] as Block & { raw?: string }
    const written = lines.slice(from, Math.min(to, lines.length)).join("\n")
    if (written !== serializeBlocks([{ ...b, gap: 0, blanks: undefined } as Block])) b.raw = written
  }

  const paragraph: string[] = []
  let paragraphIndent = ""
  const flushParagraph = () => {
    if (paragraph.length) {
      // Soft line breaks stay newlines and trailing spaces stay, so wrapped paragraphs come back as written.
      const text = paragraph.join("\n")
      if (text.trim()) {
        const node: ParagraphNode = { type: "paragraph", children: parseInline(text) }
        if (paragraphIndent) node.indent = paragraphIndent
        add(node, paragraphGap, paragraphLines)
      }
      paragraph.length = 0
    }
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    if (!trimmed) {
      flushParagraph()
      blank++
      blankLines.push(line)
      i++
      continue
    }
    gapHere = blank
    gapLines = blankLines
    blank = 0
    blankLines = []

    const oneLine = line.match(COMMAND_ONE_LINE_RE)
    if (oneLine) {
      flushParagraph()
      add(commandNode(parseAttrs(oneLine[1]), oneLine[2]))
      keepRaw(i, i + 1)
      i++
      continue
    }

    const tag = templateTag(line)
    if (tag) {
      flushParagraph()

      if (tag.name === "hint") {
        const { body, next, closing } = collectUntil(lines, i + 1, "hint")
        const style = (HINT_STYLES as string[]).includes(tag.attrs.style)
          ? (tag.attrs.style as HintStyle)
          : "info"
        const hint: HintNode = { type: "hint", style, children: [] }
        container(tagged(hint, line, closing), body, (children) => (hint.children = children))
        i = next
        continue
      }

      if (tag.name === "tabs") {
        const { body, next, closing } = collectUntil(lines, i + 1, "tabs")
        const level = Number(tag.attrs.level)
        const tabs = parseItems(body, "tab", (t, lines): TabNode => {
          const parsed = parseBody(lines)
          return ended({ type: "tab", title: t.attrs.title ?? "Tab", children: parsed.blocks }, parsed.end)
        })
        const tabsNode: TabsNode = {
          type: "tabs",
          tabs: tabs.items,
          ...(tag.attrs.sync ? { sync: tag.attrs.sync } : {}),
          ...(tag.attrs.title ? { title: tag.attrs.title } : {}),
          ...(tag.attrs.title && (level === 3 || level === 4) ? { level: level as 3 | 4 } : {}),
        }
        add(tagged(ended(tabsNode, tabs.end), line, closing))
        i = next
        continue
      }

      if (tag.name === "command") {
        const { body, next, closing } = collectUntil(lines, i + 1, "command")
        add(commandNode(tag.attrs, body.join("\n")))
        // (A block still streaming in — no end tag yet — isn't kept as written.)
        if (closing !== undefined) keepRaw(i, next)
        i = next
        continue
      }

      if (tag.name === "stepper") {
        const { body, next, closing } = collectUntil(lines, i + 1, "stepper")
        const steps = parseSteps(body)
        add(tagged(ended({ type: "stepper", steps: steps.items } as StepperNode, steps.end), line, closing))
        i = next
        continue
      }

      if (tag.name === "columns") {
        const { body, next, closing } = collectUntil(lines, i + 1, "columns")
        const columns = parseItems(body, "column", (_, lines): ColumnNode => {
          const parsed = parseBody(lines)
          return ended({ type: "column", children: parsed.blocks }, parsed.end)
        })
        add(tagged(ended({ type: "columns", columns: columns.items } as ColumnsNode, columns.end), line, closing))
        i = next
        continue
      }

      if (tag.name === "code") {
        const { body, next } = collectUntil(lines, i + 1, "code")
        const inner = parseBlocks(body)
        const code = inner.find((b) => b.type === "code")
        if (code && code.type === "code") {
          code.title = tag.attrs.title ?? null
          Object.assign(code, lineNumbersFrom(tag.attrs, code.title !== null))
          code.live = tag.attrs.live === "true"
          code.entry = tag.attrs.entry ?? null
          delete code.gap
          code.raw = lines.slice(i, next).join("\n")
          add(code)
        }
        i = next
        continue
      }

      if (tag.name === "embed") {
        add({
          type: "embed",
          url: tag.attrs.url ?? "",
          ...(tag.attrs.title ? { title: tag.attrs.title } : {}),
          ...(tag.attrs.poster ? { poster: tag.attrs.poster } : {}),
          ...(booleanAttr(tag.attrs, "autoplay") === undefined
            ? {}
            : { autoplay: booleanAttr(tag.attrs, "autoplay") }),
          ...(booleanAttr(tag.attrs, "loop") === undefined
            ? {}
            : { loop: booleanAttr(tag.attrs, "loop") }),
          ...(booleanAttr(tag.attrs, "muted") === undefined
            ? {}
            : { muted: booleanAttr(tag.attrs, "muted") }),
          ...(booleanAttr(tag.attrs, "controls") === undefined
            ? {}
            : { controls: booleanAttr(tag.attrs, "controls") }),
        })
        i++
        // tolerate optional {% endembed %}
        if (i < lines.length && templateTag(lines[i])?.name === "endembed") {
          ;(blocks[blocks.length - 1] as EmbedNode).raw = lines.slice(i - 1, i + 1).join("\n")
          i++
        }
        continue
      }

      if (tag.name === "content-ref") {
        const { body, next } = collectUntil(lines, i + 1, "content-ref")
        const inner: Inline[] = parseInline(body.join(" ").trim())
        add({ type: "content-ref", url: tag.attrs.url ?? "", children: inner })
        keepRaw(i, next)
        i = next
        continue
      }

      if (tag.name === "source-ref" || tag.name === "component" || tag.name === "story") {
        const kind = tag.name === "story" || tag.attrs.kind === "story" ? "story" : "component"
        add({
          type: "source-ref",
          mount: tag.attrs.mount ?? "source",
          path: tag.attrs.path ?? tag.attrs.src ?? "",
          exportName: tag.attrs.export ?? (kind === "story" ? "Primary" : "default"),
          kind,
          ...(tag.attrs.title ? { title: tag.attrs.title } : {}),
        })
        const from = i
        i++
        if (i < lines.length && templateTag(lines[i])?.name === `end${tag.name}`) i++
        const source = blocks[blocks.length - 1] as SourceRefNode
        const written = lines.slice(from, i).join("\n")
        if (written !== serializeBlocks([{ ...source, gap: 0 }])) source.raw = written
        continue
      }

      if (tag.name === "demo") {
        const node = parseDemoTag(tag.attrs)
        const demoStart = i
        i++
        // `{% demo … /%}` never has a body; otherwise look for inline files / {% enddemo %}.
        const body = demoBody(lines, i, /\/\s*%\}\s*$/.test(line))
        if (body) {
          if (body.files.length) node.files = body.files
          if (body.open) node.open = true
          i = body.next
        }
        add(node)
        keepRaw(demoStart, i)
        continue
      }

      if (tag.name === "updates") {
        const { body, next, closing } = collectUntil(lines, i + 1, "updates")
        const updates = parseItems(body, "update", (t, lines): UpdateNode => {
          const parsed = parseBody(lines)
          return ended({ type: "update", date: t.attrs.date ?? "", children: parsed.blocks }, parsed.end)
        })
        const updatesNode: UpdatesNode = { type: "updates", format: tag.attrs.format ?? null, updates: updates.items }
        add(tagged(ended(updatesNode, updates.end), line, closing))
        i = next
        continue
      }

      if (tag.name === "openapi-operation" || tag.name === "openapi") {
        const { body, next } = collectUntil(lines, i + 1, tag.name)
        const link = body.join(" ").match(/\[([^\]]*)\]\(([^)\s]+)\)/)
        add({
          type: "openapi-operation",
          spec: tag.attrs.spec ?? "",
          path: tag.attrs.path ?? "",
          method: tag.attrs.method ?? "",
          specUrl: link?.[2] ?? "",
          label: link?.[1] ?? "",
        })
        keepRaw(i, next)
        i = next
        continue
      }

      if (tag.name === "file") {
        // Render file blocks as content-refs for now — same shape, different chrome.
        add({ type: "content-ref", url: tag.attrs.src ?? "", children: parseInline(tag.attrs.caption ?? tag.attrs.src ?? ""), raw: line })
        i++
        continue
      }

      // Unknown template tag: kept verbatim (renderers show nothing for it).
      add({ type: "raw", markdown: line })
      i++
      continue
    }

    // <details><summary>…</summary> … </details>  (GitBook expandable)
    if (/^<details>/i.test(trimmed)) {
      flushParagraph()
      let summary = ""
      let bodyStart = i + 1
      const sameLine = trimmed.match(/<summary>(.*?)<\/summary>/i)
      if (sameLine) {
        summary = sameLine[1]
      } else {
        let j = i + 1
        while (j < lines.length && !lines[j].trim()) j++
        const m = lines[j]?.trim().match(/^<summary>(.*?)<\/summary>$/i)
        if (m) {
          summary = m[1]
          bodyStart = j + 1
        }
      }
      const { body, next, closing } = collectHtmlUntil(lines, bodyStart, "</details>")
      const expandable: ExpandableNode = { type: "expandable", summary, children: [] }
      if (closing !== undefined && closing !== "</details>") expandable.closing = closing
      const opening = lines.slice(i, bodyStart).join("\n")
      if (opening !== `<details>\n\n<summary>${summary}</summary>`) expandable.opening = opening
      container(expandable, body, (children) => (expandable.children = children), 1, 1)
      i = next
      continue
    }

    // <table …>…</table> — GitBook exports complex/cards tables as HTML
    if (/^<table[\s>]/i.test(trimmed)) {
      flushParagraph()
      // Up to the matching </table>: nested tables count, fenced code inside cells doesn't.
      let j = i
      let depth = 0
      const tableFences = fenceTracker()
      for (; j < lines.length; j++) {
        if (j > i && tableFences.step(lines[j])) continue
        depth += (lines[j].match(/<table[\s>]/gi) ?? []).length - (lines[j].match(/<\/table>/gi) ?? []).length
        if (depth <= 0) break
      }
      j = Math.min(j, lines.length - 1)
      const chunk = lines.slice(i, j + 1).join("\n")
      const tableStart = blocks.length
      const view = chunk.match(/<table[^>]*data-view="([^"]*)"/i)?.[1]
      const rowsHtml = [...chunk.matchAll(/<tr[^>]*>(.*?)<\/tr>/gis)].map((m) => m[1])
      const parseCells = (rowHtml: string): Inline[][] =>
        [...rowHtml.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis)].map((m) =>
          parseInline(htmlToInlineMd(m[1]))
        )
      const allRows = rowsHtml.map(parseCells)
      const [header, ...rest] = allRows.length ? allRows : [[]]
      add({
        type: "table",
        header: header ?? [],
        rows: rest,
        ...(view ? { view } : { html: true }),
      })
      const htmlTable = blocks[tableStart] as TableNode
      if (chunk !== serializeBlocks([{ ...htmlTable, gap: 0 }])) htmlTable.raw = chunk
      i = j + 1
      continue
    }

    // standalone <img …> line (e.g. GitBook drawings)
    const soloHtmlImg = trimmed.match(/^<img[^>]*src="([^"]*)"[^>]*>$/i)
    if (soloHtmlImg) {
      flushParagraph()
      const alt = trimmed.match(/alt="([^"]*)"/i)?.[1] ?? ""
      add(withRaw({ type: "figure", src: soloHtmlImg[1], alt, caption: "" }, line))
      i++
      continue
    }

    // <figure><img …><figcaption>…</figcaption></figure>
    if (/^<figure>/i.test(trimmed)) {
      flushParagraph()
      const chunkLines = [line]
      let j = i
      while (!chunkLines.join("\n").includes("</figure>") && j + 1 < lines.length) {
        j++
        chunkLines.push(lines[j])
      }
      const chunk = chunkLines.join("\n")
      const img = chunk.match(/<img[^>]*src="([^"]*)"[^>]*>/i)
      const alt = chunk.match(/<img[^>]*alt="([^"]*)"[^>]*>/i)
      const cap = chunk.match(/<figcaption>(.*?)<\/figcaption>/is)
      const figure: FigureNode = {
        type: "figure",
        src: img?.[1] ?? "",
        alt: alt?.[1] ?? "",
        caption: (cap?.[1] ?? "").replace(/<\/?p>/g, "").trim(),
      }
      add(withRaw(figure, chunk))
      i = j + 1
      continue
    }

    // plain markdown image on its own line
    const soloImg = trimmed.match(SOLO_IMG_RE)
    if (soloImg) {
      flushParagraph()
      const figure: FigureNode = { type: "figure", src: soloImg[2], alt: soloImg[1], caption: "" }
      if (soloImg[3] !== undefined) figure.title = soloImg[3]
      add(withRaw(figure, line))
      i++
      continue
    }

    // $$ math $$
    if (trimmed === "$$") {
      flushParagraph()
      const formula: string[] = []
      const mathStart = i
      i++
      while (i < lines.length && lines[i].trim() !== "$$") {
        formula.push(lines[i])
        i++
      }
      i++
      add({ type: "math", formula: formula.join("\n") })
      keepRaw(mathStart, i)
      continue
    }

    // fenced code (``` or ~~~)
    const fence = trimmed.match(/^(`{3,}|~{3,})([^\s`]*)?(?:\s+(.*?))?\s*$/)
    if (fence) {
      flushParagraph()
      // ```` ```title="x" ```` (attributes, no language): the first word is not a language.
      const bareAttrs = !!fence[2]?.includes("=")
      const attrs = parseAttrs(bareAttrs ? [fence[2], fence[3]].filter(Boolean).join(" ") : fence[3])
      const code: string[] = []
      i++
      while (i < lines.length && !lines[i].trim().startsWith(fence[1])) {
        code.push(lines[i])
        i++
      }
      const closingLine = i < lines.length ? lines[i] : ""
      i++
      const layout: Partial<CodeBlockNode> = {}
      const lead = line.match(/^\s*/)![0]
      if (lead + fence[1] !== "```") layout.fence = lead + fence[1]
      if (closingLine !== fence[1]) layout.closingFence = closingLine
      const infoRaw = line.trimStart().slice(fence[1].length)
      const codeNode: CodeBlockNode = {
        ...layout,
        type: "code",
        language: (!bareAttrs && fence[2]) || null,
        title: attrs.title ?? null,
        ...lineNumbersFrom(attrs, attrs.title !== undefined),
        code: code.join("\n"),
        ...(booleanAttr(attrs, "live") === undefined ? {} : { live: booleanAttr(attrs, "live") }),
        ...(attrs.entry ? { entry: attrs.entry } : {}),
        ...(positiveNumberAttr(attrs, "collapsedCodeLines") === undefined
          ? {}
          : { collapsedCodeLines: positiveNumberAttr(attrs, "collapsedCodeLines") }),
        ...(positiveNumberAttr(attrs, "expandedCodeLines") === undefined
          ? {}
          : { expandedCodeLines: positiveNumberAttr(attrs, "expandedCodeLines") }),
      }
      // The info string as written, where it isn't what serialization writes (spacing, attribute order).
      if (infoRaw !== fenceInfo(codeNode)) codeNode.info = infoRaw
      add(codeNode)
      continue
    }

    // indented code block (4+ spaces, GFM)
    if (paragraph.length === 0 && /^ {4,}\S/.test(line) && !line.trim().match(/^([-*+]|\d+[.)])\s/)) {
      const code: string[] = []
      const from = i
      while (
        i < lines.length &&
        (/^ {4,}\S/.test(lines[i]) || (!lines[i].trim() && /^ {4,}\S/.test(lines[i + 1] ?? "")))
      ) {
        code.push(lines[i].slice(4))
        i++
      }
      const indentedCode: CodeBlockNode = { type: "code", language: null, title: null, lineNumbers: false, code: code.join("\n"), indented: true }
      // Whitespace-only lines inside keep their spaces.
      const written = lines.slice(from, i).join("\n")
      if (written !== code.map((l) => (l ? `    ${l}` : l)).join("\n")) indentedCode.raw = written
      add(indentedCode)
      continue
    }

    // setext headings: a paragraph line followed by ==== (h1) or ---- (h2)
    if (paragraph.length && /^=+$/.test(trimmed)) {
      const text = paragraph.join("\n").trim()
      paragraph.length = 0
      add({ type: "heading", level: 1, children: parseInline(text), setext: trimmed }, paragraphGap, paragraphLines)
      i++
      continue
    }
    if (paragraph.length && /^-+$/.test(trimmed)) {
      const text = paragraph.join("\n").trim()
      paragraph.length = 0
      add({ type: "heading", level: 2, children: parseInline(text), setext: trimmed }, paragraphGap, paragraphLines)
      i++
      continue
    }

    // heading (GitBook exports can contain empty headings like a bare "##")
    // Trailing spaces stay in the text, so they come back.
    const heading = line.trimStart().match(/^(#{1,6})(?:\s+(.*))?$/)
    if (heading) {
      flushParagraph()
      add({
        type: "heading",
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(heading[2] ?? ""),
      })
      i++
      continue
    }

    // divider
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flushParagraph()
      add(trimmed === "---" ? { type: "divider" } : { type: "divider", marker: trimmed })
      i++
      continue
    }

    // blockquote
    if (trimmed.startsWith(">")) {
      flushParagraph()
      const quote: string[] = []
      const markers: string[] = []
      while (i < lines.length && lines[i].trim().startsWith(">")) {
        const marker = lines[i].match(/^\s*>[ \t]?/)![0]
        markers.push(marker)
        quote.push(lines[i].slice(marker.length))
        i++
      }
      const quoteNode: BlockquoteNode = { type: "blockquote", children: [] }
      if (markers.some((m, k) => m !== (quote[k] ? "> " : ">"))) quoteNode.markers = markers
      container(quoteNode, quote, (children) => (quoteNode.children = children))
      continue
    }

    // table
    if (trimmed.startsWith("|") && lines[i + 1]?.trim().match(/^\|[\s:|-]+\|$/)) {
      flushParagraph()
      const parseRow = (row: string): Inline[][] => splitTableRow(row).map((cell) => parseCell(cell.trim()))
      const header = parseRow(lines[i])
      const delimiterRow = lines[i + 1]
      i += 2
      const rows: Inline[][][] = []
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(parseRow(lines[i]))
        i++
      }
      const table: TableNode = { type: "table", header, rows }
      const rowLines = lines.slice(i - rows.length - 2, i).filter((_, k) => k !== 1)
      const align = delimiterAlign(delimiterRow)
      if (align.some((a) => a !== null)) table.align = align
      if (delimiterRow !== defaultDelimiterRow(header.length, table.align)) table.delimiterRow = delimiterRow
      const canonicalRows = serializeBlocks([{ ...table, gap: 0 }]).split("\n").filter((_, k) => k !== 1)
      if (rowLines.some((l, k) => l !== canonicalRows[k])) table.rawRows = rowLines
      add(table)
      continue
    }

    // list (unordered / ordered / task, with GFM nesting)
    const listMatch = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.*)$/)
    if (listMatch && listMatch[1].length < 4) {
      flushParagraph()
      const { list, next } = parseList(lines, i)
      add(list)
      i = next
      continue
    }

    // [label]: url "title" — a reference definition, kept where it is; a footnote definition that doesn't
    // end the document too
    const foot = line.match(FOOTNOTE_DEF_RE)
    const def = foot ? null : line.match(REF_DEF_RE)
    if (foot || (def && !def[1].startsWith("^"))) {
      flushParagraph()
      const node: DefinitionNode = foot
        ? { type: "definition", label: `^${foot[1]}`, url: foot[2], ...(foot[3] ? { title: foot[3] } : {}) }
        : { type: "definition", label: def![1], url: def![2], ...(def![3] !== undefined ? { title: def![3] } : {}) }
      if (line !== definitionLine(node)) node.raw = line
      add(node)
      i++
      continue
    }

    // Continuation lines keep their indentation and hard-break spaces, so wrapped text comes back as written.
    if (!paragraph.length) {
      paragraphGap = gapHere
      paragraphLines = gapLines
      paragraphIndent = line.match(/^\s*/)![0]
    }
    paragraph.push(paragraph.length ? line : line.trimStart())
    i++
  }

  flushParagraph()
  return { blocks, end: blank }
}

/**
 * The `{% name %}…{% endname %}` items of a container body (tabs, steps, columns, updates), with the blank
 * lines before each (`gap`: default 0 before the first, 1 between items) and after the last (`end`).
 * Other lines between items are ignored.
 */
function parseItems<T extends TaggedNode>(
  lines: string[],
  name: string,
  make: (tag: TemplateTag, body: string[]) => T,
): { items: T[]; end: number } {
  const items: T[] = []
  let blank = 0
  let i = 0
  while (i < lines.length) {
    if (!lines[i].trim()) {
      blank++
      i++
      continue
    }
    const tag = templateTag(lines[i])
    if (tag?.name === name) {
      const { body, next, closing } = collectUntil(lines, i + 1, name)
      items.push(spaced(tagged(make(tag, body), lines[i], closing), blank, items.length ? 1 : 0))
      i = next
    } else {
      i++
    }
    blank = 0
  }
  return { items, end: blank }
}

function parseSteps(lines: string[]): { items: StepNode[]; end: number } {
  return parseItems(lines, "step", (_, body): StepNode => {
    // GitBook convention: the step's first heading is its title
    const { blocks: inner, end } = parseBody(body)
    let title = ""
    const heading = inner[0]?.type === "heading" ? inner[0] : undefined
    const step: StepNode = { type: "step", title, children: inner }
    if (heading) {
      step.title = plainText(heading.children)
      inner.shift()
      // The title heading as written (level, formatting, blank lines before it), where not `### title`.
      const written = body.slice(0, (heading.gap ?? 0) + (heading.setext ? 2 : 1)).join("\n")
      if (written !== `### ${step.title}`) step.heading = written
    }
    return ended(step, end)
  })
}

interface ParsedList {
  list: Extract<Block, { type: "list" }>
  next: number
}

const LIST_ITEM_RE = /^(\s*)([-*+]|\d+[.)])(\s+)(.*)$/

// Indent-aware list parser: deeper-indented marker lines become nested lists
// inside the item (handled recursively via parseBlocks on dedented lines).
// The markers, numbering, padding, continuation indent and blank lines between items are recorded
// where they differ from what serialization writes.
function parseList(lines: string[], start: number): ParsedList {
  const first = lines[start].match(LIST_ITEM_RE)!
  const baseIndent = first[1].length
  const ordered = /^\d/.test(first[2])
  const items: ListItemNode[] = []
  const list: ListNode = { type: "list", ordered, task: false, items }
  if (first[1]) list.indent = first[1]
  if (ordered) {
    const n = Number.parseInt(first[2], 10)
    if (n !== 1) list.start = n
    if (first[2].endsWith(")")) list.delimiter = ")"
  } else if (first[2] !== "-") {
    list.bullet = first[2] as "*" | "+"
  }
  let i = start
  let gap = 0
  let blankLine = ""

  while (i < lines.length) {
    const m = lines[i].match(LIST_ITEM_RE)
    if (!m || m[1].length !== baseIndent || /^\d/.test(m[2]) !== ordered) break

    let content = m[4]
    let checked: boolean | undefined
    let checkMark: string | undefined
    const taskMatch = content.match(/^\[([ xX])\]\s+(.*)$/)
    if (taskMatch) {
      list.task = true
      checked = taskMatch[1] !== " "
      checkMark = taskMatch[1]
      content = taskMatch[2]
    }

    // Everything indented deeper than the marker belongs to this item.
    const contIndent = baseIndent + m[2].length + 1
    const minIndent = Math.min(contIndent, baseIndent + 2)
    let bodyIndent: number | undefined
    const body: string[] = []
    i++
    while (i < lines.length) {
      const raw = lines[i]
      if (!raw.trim()) {
        // blank line stays in the item only if more indented content follows
        const lookahead = lines[i + 1]
        if (lookahead !== undefined && /^\s+/.test(lookahead) && lookahead.search(/\S/) >= minIndent) {
          // Whitespace-only lines stay as written (serialization doesn't indent them).
          body.push(raw)
          i++
          continue
        }
        break
      }
      const indent = raw.search(/\S/)
      if (indent >= minIndent) {
        // The first continuation line sets the item's indent (four or more past the content is code).
        bodyIndent ??= indent >= contIndent + 4 ? contIndent : indent
        body.push(raw.slice(Math.min(indent, bodyIndent)))
        i++
        continue
      }
      break
    }

    const para: Block = { type: "paragraph", children: parseInline(content) }
    const children: Block[] = body.length ? [para, ...parseBlocks(body)] : [para]
    const item: ListItemNode = checked === undefined ? { type: "listItem", children } : { type: "listItem", children, checked }
    const expected = ordered ? `${(list.start ?? 1) + items.length}${list.delimiter ?? "."}` : (list.bullet ?? "-")
    if (m[2] !== expected) item.marker = m[2]
    if (m[3].length !== 1) item.pad = m[3].length
    if (bodyIndent !== undefined && bodyIndent - baseIndent !== 2) item.indent = bodyIndent - baseIndent
    if (checkMark === "X") item.checkMark = "X"
    if (blankLine) item.blanks = [blankLine]
    items.push(spaced(item, gap, 0))
    gap = 0
    blankLine = ""

    // skip a single blank line between sibling items
    if (i < lines.length && !lines[i].trim()) {
      const after = lines[i + 1]?.match(/^(\s*)([-*+]|\d+[.)])\s+/)
      if (after && after[1].length === baseIndent && /^\d/.test(after[2]) === ordered) {
        gap = 1
        blankLine = lines[i]
        i++
      } else break
    }
  }

  return { list, next: i }
}
