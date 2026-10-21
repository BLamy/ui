import {
  defaultInlineDelims,
  inlineDelims,
  parseMarkdown,
  plainText,
  serializeMarkdown,
  type Block,
  type CitationDef,
  type DemoLayout,
  type CommandNode,
  type DemoInlineFile,
  type DemoNode,
  type DemoViewport,
  type DocumentNode,
  type Inline,
  type InlineDelimiter,
  type InlineImageNode,
  type ListItemNode,
  type ReferenceNode,
  type TableNode,
  type TextNode,
  type TaskState,
} from "@brett_lamy/docstream/gitbook"

type SpelledMark = "bold" | "italic" | "strike" | "link"
/** The PM mark each docstream delimiter spells. */
const DELIM_MARK: Record<InlineDelimiter, SpelledMark> = {
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

// Attachment chips live in markdown as images with an `attachment:<id>` URL.
const ATTACHMENT_SCHEME = "attachment:"
const isAttachmentSrc = (src: string | undefined) => !!src && src.startsWith(ATTACHMENT_SCHEME)
const attachmentPM = (src: string, alt: string | undefined): PMNode => ({
  type: "gbAttachment",
  attrs: { id: src.slice(ATTACHMENT_SCHEME.length), name: alt ?? "" },
})

// TipTap/ProseMirror JSON shape (loosely typed on purpose)
export interface PMNode {
  type: string
  attrs?: Record<string, unknown>
  content?: PMNode[]
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>
  text?: string
}

// ---------- Markdown layout (docstream fields the editor carries opaquely in `md` attrs) ----------

/**
 * Block / item / doc fields that only say how the Markdown was laid out. Carried in the node's `md` attr
 * and handed back verbatim; docstream validates them against the (possibly edited) node on the way out.
 */
const LAYOUT_KEYS = [
  "gap",
  "blanks",
  "gapEnd",
  "opening",
  "closing",
  "raw",
  "indent",
  "setext",
  "fence",
  "info",
  "closingFence",
  "indented",
  "heading",
  "delimiterRow",
  "rawRows",
  "markers",
  "marker",
  "bullet",
  "delimiter",
  "pad",
  "checkMark",
  "html",
  "citationsGap",
  "end",
  "lineEnding",
] as const

/** Link details beyond the target, on the link mark's `md`. */
const LINK_KEYS = ["linkTitle", "linkRef", "linkTag", "linkTagEnd", "linkId"] as const
/** A code span's layout, on the code mark's `md`. */
const CODE_KEYS = ["barePipes", "ticks"] as const
/** Image syntax details, on the image / attachment node's `md`. */
const IMAGE_KEYS = ["title", "syntax", "html", "srcForm", "srcRef"] as const

function pick(from: object, keys: readonly string[]): Record<string, unknown> | null {
  const source = from as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const k of keys) if (source[k] !== undefined) out[k] = source[k]
  return Object.keys(out).length ? out : null
}

/** `pm` with the block's layout fields in its `md` attr. */
function withLayout(pm: PMNode, from: object): PMNode {
  const md = pick(from, LAYOUT_KEYS)
  return md ? { ...pm, attrs: { ...pm.attrs, md } } : pm
}

/** The layout fields a PM node carries, to spread onto the block. */
function layoutOf(n: PMNode | undefined): Record<string, unknown> {
  const md = n?.attrs?.md
  return md && typeof md === "object" ? pick(md, LAYOUT_KEYS) ?? {} : {}
}

// ---------- AST → TipTap ----------

type PMMark = NonNullable<PMNode["marks"]>[number]

/** Is the inline's `link` a link mark (not the HTML anchor of an `<a href><img></a>` badge)? */
function linkIsMark(n: Inline): boolean {
  if (!n.link) return false
  return n.type !== "image" || !!n.delims?.some((d) => DELIM_MARK[d] === "link")
}

/**
 * The PM marks for an inline's formatting (text runs, chips and images alike). A run spelled other than the
 * default (`***x***`, `**_x_**`, `*x*`, `*a *b* c*`) puts each mark's marker and nesting depth on the mark
 * (`delim` / `depth`, further occurrences in `more`); `tiptapToAst` turns them back into `delims`.
 */
function marksPM(n: Inline): PMMark[] {
  const spelling = n.delims?.length ? inlineDelims(n) : []
  const spelled = (mark: SpelledMark): Record<string, unknown> => {
    const at = spelling.flatMap((d, depth): Array<[number, InlineDelimiter]> => (DELIM_MARK[d] === mark ? [[depth, d]] : []))
    if (!at.length) return {}
    const [[depth, delim], ...more] = at
    return { delim, depth, ...(more.length ? { more } : {}) }
  }
  const marks: PMMark[] = []
  const emphasis = (type: "bold" | "italic" | "strike") => {
    const attrs = spelled(type)
    marks.push(Object.keys(attrs).length ? { type, attrs } : { type })
  }
  if (n.bold) emphasis("bold")
  if (n.italic) emphasis("italic")
  if (n.strike) emphasis("strike")
  if (n.type === "text" && n.code) {
    const md = pick(n, CODE_KEYS)
    marks.push(md ? { type: "code", attrs: { md } } : { type: "code" })
  }
  if (n.type === "text" && n.escaped) marks.push({ type: "mdEscaped" })
  // `inner` keeps `**[x](url)**` (link inside the emphasis) apart from `[**x**](url)`.
  if (linkIsMark(n)) {
    const md = pick(n, LINK_KEYS)
    marks.push({
      type: "link",
      attrs: { href: n.link, ...(n.linkInner ? { inner: true } : {}), ...spelled("link"), ...(md ? { md } : {}) },
    })
  }
  return marks
}

const marked = (pm: PMNode, n: Inline): PMNode => {
  const marks = marksPM(n)
  return marks.length ? { ...pm, marks } : pm
}

function inlineToPM(nodes: Inline[]): PMNode[] {
  return nodes
    // Only empty text runs without a link are dropped — every other inline must pass, or it silently
    // vanishes on the first edit round-trip.
    .filter((n) => n.type !== "text" || n.text.length > 0 || !!n.link)
    .map((n) => {
      if (n.type === "reference") {
        return marked({ type: "gbReference", attrs: { kind: n.kind, id: n.id, url: n.url ?? "", label: n.label ?? "" } }, n)
      }
      if (n.type === "image") {
        const md = pick(n, IMAGE_KEYS)
        if (isAttachmentSrc(n.src)) {
          const chip = attachmentPM(n.src, n.alt)
          // Chips are Markdown images by default; only another spelling is recorded.
          const chipMd = md && !(Object.keys(md).length === 1 && md.syntax === "markdown") ? md : null
          return marked(chipMd ? { ...chip, attrs: { ...chip.attrs, md: chipMd } } : chip, n)
        }
        return marked(
          {
            type: "gbInlineImage",
            attrs: {
              src: n.src,
              alt: n.alt ?? "",
              width: n.width ?? "",
              height: n.height ?? "",
              // The badge's own HTML anchor; a Markdown link around the image is a link mark instead.
              link: linkIsMark(n) ? "" : (n.link ?? ""),
              ...(md ? { md } : {}),
            },
          },
          n,
        )
      }
      // `[](url)`: a link without text
      if (!n.text) return marked({ type: "gbEmptyLink" }, n)
      return marked({ type: "text", text: n.text }, n)
    })
    .flatMap(splitHardBreaks)
}

/** A `\`-newline hard break inside a text run is a real line break in the editor. */
function splitHardBreaks(n: PMNode): PMNode[] {
  if (n.type !== "text" || !n.text?.includes("\\\n") || n.marks?.some((m) => m.type === "code")) return [n]
  const out: PMNode[] = []
  n.text.split("\\\n").forEach((part, i) => {
    if (i) out.push({ type: "hardBreak", ...(n.marks?.length ? { marks: n.marks } : {}) })
    if (part) out.push({ ...n, text: part })
  })
  return out
}

const paragraphPM = (children: Inline[]): PMNode => {
  const content = inlineToPM(children)
  return content.length ? { type: "paragraph", content } : { type: "paragraph" }
}

// Containers require block+ content; empty GitBook blocks get a placeholder paragraph.
const blocksPM = (children: Block[]): PMNode[] =>
  children.length ? children.map(blockToPM) : [{ type: "paragraph" }]

function listItemToPM(item: ListItemNode, task: boolean): PMNode {
  return withLayout(
    {
      type: task ? "taskItem" : "listItem",
      ...(task ? { attrs: { checked: !!item.checked, ...(item.state ? { state: item.state } : {}) } } : {}),
      content: item.children.map(blockToPM),
    },
    item,
  )
}

function blockToPM(b: Block): PMNode {
  // A chip alone on its line is a paragraph in the editor: only its spacing carries over.
  const layout = b.type === "figure" && isAttachmentSrc(b.src) ? { gap: b.gap, blanks: b.blanks } : b
  return withLayout(blockContentToPM(b), layout)
}

function blockContentToPM(b: Block): PMNode {
  switch (b.type) {
    case "paragraph":
      return paragraphPM(b.children)
    case "heading":
      return { type: "heading", attrs: { level: b.level }, content: inlineToPM(b.children) }
    case "code":
      return {
        type: "codeBlock",
        attrs: {
          language: b.language,
          title: b.title,
          lineNumbers: b.lineNumbers,
          lineNumbersExplicit: b.lineNumbersExplicit ? true : null,
          live: !!b.live,
          entry: b.entry ?? null,
          collapsedCodeLines: b.collapsedCodeLines ?? null,
          expandedCodeLines: b.expandedCodeLines ?? null,
        },
        content: b.code ? [{ type: "text", text: b.code }] : [],
      }
    case "hint":
      return { type: "gbHint", attrs: { style: b.style }, content: blocksPM(b.children) }
    case "tabs": {
      const attrs = {
        ...(b.sync ? { sync: b.sync } : {}),
        ...(b.title ? { title: b.title } : {}),
        ...(b.level ? { level: b.level } : {}),
      }
      return {
        type: "gbTabs",
        ...(Object.keys(attrs).length ? { attrs } : {}),
        content: b.tabs.map((t) => withLayout({ type: "gbTab", attrs: { title: t.title }, content: blocksPM(t.children) }, t)),
      }
    }
    case "command":
      return {
        type: "gbCommand",
        attrs: {
          command: b.command,
          overrides: b.overrides && Object.keys(b.overrides).length ? { ...b.overrides } : null,
          sync: b.sync ?? null,
        },
      }
    case "expandable":
      return {
        type: "gbExpandable",
        attrs: { summary: b.summary },
        content: blocksPM(b.children),
      }
    case "stepper":
      return {
        type: "gbStepper",
        content: b.steps.map((s) => withLayout({ type: "gbStep", attrs: { title: s.title }, content: blocksPM(s.children) }, s)),
      }
    case "embed": {
      const attrs: Record<string, string | boolean> = { url: b.url }
      if (b.title !== undefined) attrs.title = b.title
      if (b.poster !== undefined) attrs.poster = b.poster
      if (b.autoplay !== undefined) attrs.autoplay = b.autoplay
      if (b.loop !== undefined) attrs.loop = b.loop
      if (b.muted !== undefined) attrs.muted = b.muted
      if (b.controls !== undefined) attrs.controls = b.controls
      return { type: "gbEmbed", attrs }
    }
    case "content-ref": {
      // GitBook writes the label as a link to the page (`[Card](card.md)`); remember
      // whether this one was, so a plain label stays plain.
      const only = b.children.length === 1 ? b.children[0] : undefined
      const linked = only?.type === "text" && only.link === b.url && !only.bold && !only.italic && !only.strike && !only.code
      const label = plainText(b.children)
      // Children the label / linked model can't say (emphasis, several runs, a spelled link) ride along.
      const simple: Inline[] = label ? [{ type: "text", text: label, ...(linked ? { link: b.url } : {}) }] : []
      const children = JSON.stringify(simple) === JSON.stringify(b.children) ? {} : { children: b.children }
      return { type: "gbContentRef", attrs: { url: b.url, label, linked, ...children } }
    }
    case "source-ref":
      return {
        type: "gbSourceRef",
        attrs: {
          mount: b.mount,
          path: b.path,
          exportName: b.exportName,
          kind: b.kind,
          title: b.title ?? "",
        },
      }
    case "demo":
      return {
        type: "gbDemo",
        attrs: {
          src: b.src,
          title: b.title ?? "",
          description: b.description ?? "",
          height: b.height ?? "",
          layout: b.layout ?? null,
          variants: b.variants?.length ? b.variants.map((v) => ({ id: v.id, label: v.label })) : null,
          viewport: b.viewport ?? null,
          entry: b.entry ?? null,
          status: b.status ?? null,
          bleed: b.bleed ?? null,
          className: b.className ?? null,
          surface: b.surface ?? null,
          variantsWidth: b.variantsWidth ?? null,
          files: b.files?.length ? b.files.map((f) => ({ ...f })) : null,
        },
      }
    case "columns":
      return {
        type: "gbColumns",
        content: b.columns.map((c) => withLayout({ type: "gbColumn", content: blocksPM(c.children) }, c)),
      }
    case "figure":
      // A chip alone on its line parses as a figure; it is still a chip.
      if (isAttachmentSrc(b.src)) return { type: "paragraph", content: [attachmentPM(b.src, b.alt)] }
      return { type: "gbFigure", attrs: { src: b.src, alt: b.alt, caption: b.caption, ...(b.title !== undefined ? { title: b.title } : {}) } }
    case "list":
      return {
        type: b.task ? "taskList" : b.ordered ? "orderedList" : "bulletList",
        ...(b.ordered && !b.task && b.start !== undefined ? { attrs: { start: b.start } } : {}),
        content: b.items.map((item) => listItemToPM(item, b.task)),
      }
    case "blockquote":
      return { type: "blockquote", content: blocksPM(b.children) }
    case "divider":
      return { type: "horizontalRule" }
    case "table":
      return {
        type: "table",
        ...(b.view || b.align ? { attrs: { ...(b.view ? { view: b.view } : {}), ...(b.align ? { align: b.align } : {}) } } : {}),
        content: [
          {
            type: "tableRow",
            content: b.header.map((cell) => ({
              type: "tableHeader",
              content: [paragraphPM(cell)],
            })),
          },
          ...b.rows.map((row) => ({
            type: "tableRow",
            content: row.map((cell) => ({ type: "tableCell", content: [paragraphPM(cell)] })),
          })),
        ],
      }
    case "math":
      return { type: "gbMath", attrs: { formula: b.formula } }
    case "updates":
      return {
        type: "gbUpdates",
        attrs: { format: b.format },
        content: b.updates.map((u) => withLayout({ type: "gbUpdate", attrs: { date: u.date }, content: blocksPM(u.children) }, u)),
      }
    case "definition":
      return { type: "gbDefinition", attrs: { label: b.label, url: b.url, title: b.title ?? null } }
    case "raw":
      return { type: "gbRaw", attrs: { markdown: b.markdown } }
    case "openapi-operation":
      return {
        type: "gbOpenapi",
        attrs: {
          spec: b.spec,
          path: b.path,
          method: b.method,
          specUrl: b.specUrl,
          label: b.label,
        },
      }
  }
}

export function astToTiptap(doc: DocumentNode): PMNode {
  const content = doc.children.map(blockToPM)
  return withLayout({ type: "doc", ...(doc.properties ? { attrs: { properties: doc.properties } } : {}), content: content.length ? content : [{ type: "paragraph" }] }, doc)
}

// ---------- TipTap → AST ----------

/** Applies PM marks to an inline: emphasis, code, escapes, the link and their spelling (`delims`). */
function applyMarks(inline: Inline, marks: PMNode["marks"]) {
  const spelling: Array<[number, InlineDelimiter]> = []
  let linkMark = false
  for (const mark of marks ?? []) {
    if (mark.type === "bold") inline.bold = true
    if (mark.type === "italic") inline.italic = true
    if (mark.type === "strike") inline.strike = true
    if (inline.type === "text" && mark.type === "code") {
      inline.code = true
      Object.assign(inline, pick((mark.attrs?.md as object | null) ?? {}, CODE_KEYS))
    }
    if (inline.type === "text" && mark.type === "mdEscaped") inline.escaped = true
    if (mark.type === "link") {
      linkMark = true
      inline.link = String(mark.attrs?.href ?? "")
      if (mark.attrs?.inner) inline.linkInner = true
      Object.assign(inline, pick((mark.attrs?.md as object | null) ?? {}, LINK_KEYS))
    }
    const delim = mark.attrs?.delim as InlineDelimiter | undefined
    const depth = mark.attrs?.depth
    if (delim && typeof depth === "number" && DELIM_MARK[delim] === mark.type) spelling.push([depth, delim])
    const more = mark.attrs?.more
    if (Array.isArray(more)) {
      for (const entry of more) {
        if (Array.isArray(entry) && typeof entry[0] === "number" && DELIM_MARK[entry[1] as InlineDelimiter] === mark.type) {
          spelling.push([entry[0], entry[1] as InlineDelimiter])
        }
      }
    }
  }
  const emphasis = inline.bold || inline.italic || inline.strike
  if (inline.linkInner && !emphasis) delete inline.linkInner
  // A link mark put on an image in the editor stays a Markdown link around it.
  if (inline.type === "image" && linkMark && !spelling.some(([, d]) => DELIM_MARK[d] === "link")) {
    spelling.push([inline.linkInner ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY, "link"])
  }
  if (spelling.length) {
    const delims = spelling.sort((a, b) => a[0] - b[0]).map(([, d]) => d)
    const fallback = defaultInlineDelims(inline)
    if (delims.length !== fallback.length || delims.some((d, k) => d !== fallback[k])) inline.delims = delims
  }
}

/** `lineBreak`: what a hard break becomes — `\\` + newline, or a space where a line can't end (a table cell). */
function pmTextToInline(nodes: PMNode[] | undefined, lineBreak = "\\\n"): Inline[] {
  if (!nodes) return []
  const breaks = new Set<Inline>()
  return nodes
    .map((n): PMNode => (n.type === "hardBreak" ? { ...n, type: "text", text: lineBreak, attrs: { lineBreak: true } } : n))
    .filter(
      (n) =>
        (n.type === "text" && n.text) ||
        n.type === "gbInlineImage" ||
        n.type === "gbReference" ||
        n.type === "gbAttachment" ||
        n.type === "gbEmptyLink"
    )
    .map((n): Inline => {
      let inline: Inline
      if (n.type === "gbAttachment") {
        const a = n.attrs ?? {}
        // Chips are Markdown images unless the source wrote them otherwise.
        const md = pick((a.md as object | null) ?? {}, IMAGE_KEYS) ?? { syntax: "markdown" }
        inline = {
          type: "image",
          src: `${ATTACHMENT_SCHEME}${String(a.id ?? "")}`,
          ...(a.name ? { alt: String(a.name) } : {}),
          ...md,
        } as InlineImageNode
      } else if (n.type === "gbReference") {
        const a = n.attrs ?? {}
        const kind =
          a.kind === "tag" || a.kind === "codebase" || a.kind === "citation" ? a.kind : "mention"
        inline = {
          type: "reference",
          kind,
          id: String(a.id ?? ""),
          ...(a.url ? { url: String(a.url) } : {}),
          ...(a.label ? { label: String(a.label) } : {}),
        } satisfies ReferenceNode
      } else if (n.type === "gbInlineImage") {
        const a = n.attrs ?? {}
        inline = {
          type: "image",
          src: String(a.src ?? ""),
          ...(a.alt ? { alt: String(a.alt) } : {}),
          ...(a.width ? { width: String(a.width) } : {}),
          ...(a.height ? { height: String(a.height) } : {}),
          ...(a.link ? { link: String(a.link) } : {}),
          ...pick((a.md as object | null) ?? {}, IMAGE_KEYS),
        } as InlineImageNode
      } else {
        inline = { type: "text", text: n.type === "gbEmptyLink" ? "" : n.text! } satisfies TextNode
      }
      applyMarks(inline, n.marks)
      if (n.attrs?.lineBreak) breaks.add(inline)
      return inline
    })
    .reduce<Inline[]>((out, inline) => {
      // A line break is part of the text run around it (the parser keeps `a\\\nb` as one run).
      const prev = out[out.length - 1]
      if (prev && (breaks.has(inline) || breaks.has(prev)) && sameRun(prev, inline)) {
        out[out.length - 1] = { ...(prev as TextNode), text: (prev as TextNode).text + (inline as TextNode).text }
        if (breaks.has(inline)) breaks.add(out[out.length - 1]!)
      } else out.push(inline)
      return out
    }, [])
}

/** Two text inlines with the same marks and details, differing only in their text. */
function sameRun(a: Inline, b: Inline): boolean {
  if (a.type !== "text" || b.type !== "text") return false
  const { text: _a, ...ra } = a
  const { text: _b, ...rb } = b
  return JSON.stringify(ra) === JSON.stringify(rb)
}

function pmCellToInline(cell: PMNode): Inline[] {
  // A Markdown table cell is one line: its paragraphs (Enter in a cell) and hard breaks join
  // with spaces, so no text is lost.
  const out: Inline[] = []
  for (const p of cell.content ?? []) {
    const inlines = pmTextToInline(p.content, " ")
    if (!inlines.length) continue
    if (out.length) out.push({ type: "text", text: " " })
    out.push(...inlines)
  }
  return out
}

function pmToBlock(n: PMNode): Block | null {
  const block = pmContentToBlock(n)
  return block ? ({ ...block, ...layoutOf(n) } as Block) : null
}

/** An item node (tab, step, column, update, list item) with its layout. */
const item = <T extends object>(n: PMNode, value: T): T => ({ ...value, ...layoutOf(n) })

function pmContentToBlock(n: PMNode): Block | null {
  switch (n.type) {
    case "paragraph": {
      const children = pmTextToInline(n.content)
      if (!children.length) return null // drop empty paragraphs from markdown
      return { type: "paragraph", children }
    }
    case "heading":
      return {
        type: "heading",
        level: (Number(n.attrs?.level) || 1) as 1 | 2 | 3 | 4 | 5 | 6,
        children: pmTextToInline(n.content),
      }
    case "codeBlock": {
      const collapsed = Number(n.attrs?.collapsedCodeLines) || 0
      const expanded = Number(n.attrs?.expandedCodeLines) || 0
      return {
        type: "code",
        language: (n.attrs?.language as string) || null,
        title: (n.attrs?.title as string) || null,
        lineNumbers: !!n.attrs?.lineNumbers,
        ...(n.attrs?.lineNumbersExplicit ? { lineNumbersExplicit: true } : {}),
        live: !!n.attrs?.live,
        entry: (n.attrs?.entry as string) || null,
        ...(collapsed ? { collapsedCodeLines: collapsed } : {}),
        ...(expanded ? { expandedCodeLines: expanded } : {}),
        code: n.content?.map((c) => c.text ?? "").join("") ?? "",
      }
    }
    case "gbHint":
      return {
        type: "hint",
        style: (n.attrs?.style as never) ?? "info",
        children: pmToBlocks(n.content),
      }
    case "gbTabs": {
      const level = Number(n.attrs?.level)
      return {
        type: "tabs",
        tabs: (n.content ?? []).map((t) =>
          item(t, { type: "tab" as const, title: String(t.attrs?.title ?? "Tab"), children: pmToBlocks(t.content) }),
        ),
        ...(n.attrs?.sync ? { sync: String(n.attrs.sync) } : {}),
        ...(n.attrs?.title ? { title: String(n.attrs.title) } : {}),
        ...(level === 2 || level === 3 || level === 4 ? { level } : {}),
      }
    }
    case "gbCommand":
      return pmToCommand(n.attrs ?? {})
    case "gbExpandable":
      return {
        type: "expandable",
        summary: String(n.attrs?.summary ?? ""),
        children: pmToBlocks(n.content),
      }
    case "gbStepper":
      return {
        type: "stepper",
        steps: (n.content ?? []).map((s) =>
          item(s, { type: "step" as const, title: String(s.attrs?.title ?? ""), children: pmToBlocks(s.content) }),
        ),
      }
    case "gbEmbed": {
      const embed: Extract<Block, { type: "embed" }> = {
        type: "embed",
        url: String(n.attrs?.url ?? ""),
      }
      if (typeof n.attrs?.title === "string") embed.title = n.attrs.title
      if (typeof n.attrs?.poster === "string") embed.poster = n.attrs.poster
      if (typeof n.attrs?.autoplay === "boolean") embed.autoplay = n.attrs.autoplay
      if (typeof n.attrs?.loop === "boolean") embed.loop = n.attrs.loop
      if (typeof n.attrs?.muted === "boolean") embed.muted = n.attrs.muted
      if (typeof n.attrs?.controls === "boolean") embed.controls = n.attrs.controls
      return embed
    }
    case "gbContentRef": {
      const url = String(n.attrs?.url ?? "")
      const label = String(n.attrs?.label ?? "")
      const linked = n.attrs?.linked !== false && !!url && !!label
      // Children the label model can't say are carried along while the label is unchanged.
      const carried = Array.isArray(n.attrs?.children) ? (n.attrs.children as Inline[]) : null
      return {
        type: "content-ref",
        url,
        children:
          carried && plainText(carried) === label
            ? carried
            : label
              ? [{ type: "text", text: label, ...(linked ? { link: url } : {}) }]
              : [],
      }
    }
    case "gbSourceRef":
      return {
        type: "source-ref",
        mount: String(n.attrs?.mount ?? "source"),
        path: String(n.attrs?.path ?? ""),
        exportName: String(n.attrs?.exportName ?? "default"),
        kind: n.attrs?.kind === "story" ? "story" : "component",
        ...(n.attrs?.title ? { title: String(n.attrs.title) } : {}),
      }
    case "gbDemo":
      return pmToDemo(n.attrs ?? {})
    case "gbColumns":
      return {
        type: "columns",
        columns: (n.content ?? []).map((c) => item(c, { type: "column" as const, children: pmToBlocks(c.content) })),
      }
    case "gbFigure":
      return {
        type: "figure",
        src: String(n.attrs?.src ?? ""),
        alt: String(n.attrs?.alt ?? ""),
        caption: String(n.attrs?.caption ?? ""),
        ...(typeof n.attrs?.title === "string" ? { title: n.attrs.title } : {}),
      }
    case "gbMath":
      return { type: "math", formula: String(n.attrs?.formula ?? "") }
    case "gbUpdates":
      return {
        type: "updates",
        format: (n.attrs?.format as string) || null,
        updates: (n.content ?? []).map((u) =>
          item(u, { type: "update" as const, date: String(u.attrs?.date ?? ""), children: pmToBlocks(u.content) }),
        ),
      }
    case "gbDefinition":
      return {
        type: "definition",
        label: String(n.attrs?.label ?? ""),
        url: String(n.attrs?.url ?? ""),
        ...(typeof n.attrs?.title === "string" ? { title: n.attrs.title } : {}),
      }
    case "gbRaw":
      return { type: "raw", markdown: String(n.attrs?.markdown ?? "") }
    case "gbOpenapi":
      return {
        type: "openapi-operation",
        spec: String(n.attrs?.spec ?? ""),
        path: String(n.attrs?.path ?? ""),
        method: String(n.attrs?.method ?? ""),
        specUrl: String(n.attrs?.specUrl ?? ""),
        label: String(n.attrs?.label ?? ""),
      }
    case "bulletList":
    case "orderedList":
    case "taskList": {
      const task = n.type === "taskList"
      const start = n.type === "orderedList" ? Number(n.attrs?.start ?? 1) : 1
      return {
        type: "list",
        ordered: n.type === "orderedList",
        task,
        items: (n.content ?? []).map((pmItem) => {
          const base: ListItemNode = { type: "listItem", children: pmToBlocks(pmItem.content) }
          if (task) base.checked = !!pmItem.attrs?.checked
          if (task && pmItem.attrs?.state) base.state = pmItem.attrs.state as TaskState
          if (!base.children.length) base.children = [{ type: "paragraph", children: [] }]
          return item(pmItem, base)
        }),
        ...(Number.isInteger(start) && start !== 1 ? { start } : {}),
      }
    }
    case "blockquote":
      return { type: "blockquote", children: pmToBlocks(n.content) }
    case "horizontalRule":
      return { type: "divider" }
    case "table": {
      const rows = n.content ?? []
      const [head, ...body] = rows
      const view = n.attrs?.view as string | undefined
      const align = Array.isArray(n.attrs?.align) ? (n.attrs.align as TableNode["align"]) : undefined
      return {
        type: "table",
        header: (head?.content ?? []).map(pmCellToInline),
        rows: body.map((r) => (r.content ?? []).map(pmCellToInline)),
        ...(view ? { view } : {}),
        ...(align ? { align } : {}),
      }
    }
    default:
      return null
  }
}

const DEMO_LAYOUTS: readonly string[] = ["auto", "single", "multi"] satisfies DemoLayout[]
const DEMO_VIEWPORTS: readonly string[] = ["desktop", "tablet", "phone"] satisfies DemoViewport[]

/** `gbDemo` attrs → `DemoNode`; also used by the node view to build the preview. */
export function pmToDemo(a: Record<string, unknown>): DemoNode {
  const variants = Array.isArray(a.variants)
    ? (a.variants as Array<{ id?: unknown; label?: unknown }>)
        .filter((v) => v && v.id)
        .map((v) => ({ id: String(v.id), label: String(v.label || v.id) }))
    : []
  const layout = String(a.layout ?? "")
  const files = pmDemoFiles(a.files)
  const viewport = String(a.viewport ?? "")
  const bleed = a.bleed === true || a.bleed === "true" ? true : a.bleed === false || a.bleed === "false" ? false : undefined
  return {
    type: "demo",
    src: String(a.src ?? ""),
    ...(a.title ? { title: String(a.title) } : {}),
    ...(a.description ? { description: String(a.description) } : {}),
    ...(a.height ? { height: String(a.height) } : {}),
    ...(DEMO_LAYOUTS.includes(layout) ? { layout: layout as DemoLayout } : {}),
    ...(variants.length ? { variants } : {}),
    ...(DEMO_VIEWPORTS.includes(viewport) ? { viewport: viewport as DemoViewport } : {}),
    ...(a.entry ? { entry: String(a.entry) } : {}),
    ...(a.status ? { status: String(a.status) } : {}),
    ...(bleed === undefined ? {} : { bleed }),
    ...(a.className ? { className: String(a.className) } : {}),
    ...(a.surface ? { surface: String(a.surface) } : {}),
    ...(a.variantsWidth ? { variantsWidth: String(a.variantsWidth) } : {}),
    ...(files.length ? { files } : {}),
  }
}

/** `gbDemo`'s `files` attr → inline demo files (malformed entries dropped). */
export function pmDemoFiles(value: unknown): DemoInlineFile[] {
  if (!Array.isArray(value)) return []
  return (value as Array<Record<string, unknown> | null>)
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({
      path: String(f.path ?? ""),
      content: String(f.content ?? ""),
      ...(f.language ? { language: String(f.language) } : {}),
    }))
}

const COMMAND_OVERRIDES = ["pnpm", "yarn", "bun"] as const

/** `gbCommand` attrs → `CommandNode`; also used by the node view to render the box. */
export function pmToCommand(a: Record<string, unknown>): CommandNode {
  const raw = (a.overrides && typeof a.overrides === "object" ? a.overrides : {}) as Record<string, unknown>
  const overrides: NonNullable<CommandNode["overrides"]> = {}
  for (const pm of COMMAND_OVERRIDES) if (raw[pm]) overrides[pm] = String(raw[pm])
  return {
    type: "command",
    command: String(a.command ?? ""),
    ...(Object.keys(overrides).length ? { overrides } : {}),
    ...(a.sync ? { sync: String(a.sync) } : {}),
  }
}

function pmToBlocks(nodes: PMNode[] | undefined): Block[] {
  return separateAdjacentLists((nodes ?? []).map(pmToBlock).filter((b): b is Block => b !== null))
}

/**
 * Two lists side by side stay two lists only if their markers differ: in Markdown (CommonMark,
 * and docstream's parser) a list continues while the bullet (`-` `*` `+`) or the ordered
 * delimiter (`.` `)`) stays the same. A list made in the editor right after another of its kind
 * gets the other marker, so saving and reopening doesn't merge them.
 */
function separateAdjacentLists(blocks: Block[]): Block[] {
  for (let i = 1; i < blocks.length; i++) {
    const prev = blocks[i - 1]!
    const cur = blocks[i]!
    if (prev.type !== "list" || cur.type !== "list" || prev.ordered !== cur.ordered) continue
    if (cur.ordered) {
      if ((prev.delimiter ?? ".") !== (cur.delimiter ?? ".")) continue
      const { delimiter: _d, ...rest } = cur
      // Per-item markers carry their own delimiter (`2)`); rewrite them to the list's new one.
      const delimiter = prev.delimiter === ")" ? "." : ")"
      const items = cur.items.map((it) => (it.marker ? { ...it, marker: it.marker.replace(/[.)]$/, delimiter) } : it))
      blocks[i] = delimiter === ")" ? { ...rest, items, delimiter } : { ...rest, items }
    } else {
      if ((prev.bullet ?? "-") !== (cur.bullet ?? "-")) continue
      const bullet = prev.bullet === undefined ? "*" : undefined
      // Item markers are the list's bullet now; a stale per-item one would undo the split.
      const next = { ...cur, items: cur.items.map(({ marker: _m, ...it }) => it) } as typeof cur
      if (bullet) next.bullet = bullet
      else delete next.bullet
      blocks[i] = next
    }
  }
  return blocks
}

export function tiptapToAst(doc: PMNode): DocumentNode {
  return { type: "doc", children: pmToBlocks(doc.content), ...layoutOf(doc), ...(doc.attrs?.properties ? { properties: doc.attrs.properties as DocumentNode["properties"] } : {}) }
}

/** Attachment chips with no recorded syntax are Markdown images (they read, and diff, better). */
function attachmentsAsMarkdown<T>(value: T): T {
  if (Array.isArray(value)) return value.map(attachmentsAsMarkdown) as T
  if (!value || typeof value !== "object") return value
  const node = value as Record<string, unknown>
  if (node.type === "image" && isAttachmentSrc(node.src as string) && !node.syntax && !node.html) {
    return { ...node, syntax: "markdown" } as T
  }
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node)) out[k] = v && typeof v === "object" ? attachmentsAsMarkdown(v) : v
  return out as T
}

/**
 * Serialize an editor AST to GitBook markdown, writing new attachment chips as
 * `![name](attachment:<id>)` (a name with an unbalanced `]` keeps the `<img>` form), and
 * everything else as docstream does. Use this instead of `serializeMarkdown` for editor output.
 */
export function serializeEditorMarkdown(doc: DocumentNode): string {
  return serializeMarkdown(attachmentsAsMarkdown(doc))
}

/**
 * Plain-text Markdown pasted into the editor (a docs page's "Copy page", a `{% … %}`
 * block, a fence, a list, a heading…) as editor blocks, or null when the text is just
 * prose — which the editor then pastes as text, as usual.
 */
export function markdownPasteContent(text: string): { content: PMNode[]; citations?: CitationDef[] } | null {
  if (!text.trim()) return null
  const doc = parseMarkdown(text)
  const blocks = doc.children.some((b) => b.type !== "paragraph") || /(^|\n)\s*\{%\s*[a-z-]+/.test(text)
  if (!blocks && !doc.citations?.length) return null
  const content = astToTiptap(doc).content ?? []
  return { content, ...(doc.citations?.length ? { citations: doc.citations } : {}) }
}
