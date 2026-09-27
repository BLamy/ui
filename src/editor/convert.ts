import {
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
  type ListItemNode,
} from "@brett_lamy/docstream/gitbook"

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

// ---------- AST → TipTap ----------

function inlineToPM(nodes: Inline[]): PMNode[] {
  return nodes
    // Only empty text nodes are dropped — every non-text inline must pass, or
    // it silently vanishes on the first edit round-trip.
    .filter((n) => n.type !== "text" || n.text.length > 0)
    .map((n) => {
      if (n.type === "reference") {
        return {
          type: "gbReference",
          attrs: { kind: n.kind, id: n.id, url: n.url ?? "", label: n.label ?? "" },
        }
      }
      if (n.type === "image" && isAttachmentSrc(n.src)) return attachmentPM(n.src, n.alt)
      if (n.type === "image") {
        return {
          type: "gbInlineImage",
          attrs: {
            src: n.src,
            alt: n.alt ?? "",
            width: n.width ?? "",
            height: n.height ?? "",
            link: n.link ?? "",
          },
        }
      }
      const marks: PMNode["marks"] = []
      if (n.bold) marks.push({ type: "bold" })
      if (n.italic) marks.push({ type: "italic" })
      if (n.strike) marks.push({ type: "strike" })
      if (n.code) marks.push({ type: "code" })
      // `inner` keeps `**[x](url)**` (link inside the emphasis) apart from `[**x**](url)`.
      if (n.link) marks.push({ type: "link", attrs: { href: n.link, ...(n.linkInner ? { inner: true } : {}) } })
      return { type: "text", text: n.text, ...(marks.length ? { marks } : {}) }
    })
}

const paragraphPM = (children: Inline[]): PMNode => {
  const content = inlineToPM(children)
  return content.length ? { type: "paragraph", content } : { type: "paragraph" }
}

// Containers require block+ content; empty GitBook blocks get a placeholder paragraph.
const blocksPM = (children: Block[]): PMNode[] =>
  children.length ? children.map(blockToPM) : [{ type: "paragraph" }]

function listItemToPM(item: ListItemNode, task: boolean): PMNode {
  return {
    type: task ? "taskItem" : "listItem",
    ...(task ? { attrs: { checked: !!item.checked } } : {}),
    content: item.children.map(blockToPM),
  }
}

function blockToPM(b: Block): PMNode {
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
        content: b.tabs.map((t) => ({
          type: "gbTab",
          attrs: { title: t.title },
          content: blocksPM(t.children),
        })),
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
        content: b.steps.map((s) => ({
          type: "gbStep",
          attrs: { title: s.title },
          content: blocksPM(s.children),
        })),
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
      return { type: "gbContentRef", attrs: { url: b.url, label: plainText(b.children), linked } }
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
        content: b.columns.map((c) => ({ type: "gbColumn", content: blocksPM(c.children) })),
      }
    case "figure":
      // A chip alone on its line parses as a figure; it is still a chip.
      if (isAttachmentSrc(b.src)) return { type: "paragraph", content: [attachmentPM(b.src, b.alt)] }
      return { type: "gbFigure", attrs: { src: b.src, alt: b.alt, caption: b.caption } }
    case "list":
      return {
        type: b.task ? "taskList" : b.ordered ? "orderedList" : "bulletList",
        content: b.items.map((item) => listItemToPM(item, b.task)),
      }
    case "blockquote":
      return { type: "blockquote", content: blocksPM(b.children) }
    case "divider":
      return { type: "horizontalRule" }
    case "table":
      return {
        type: "table",
        ...(b.view ? { attrs: { view: b.view } } : {}),
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
        content: b.updates.map((u) => ({
          type: "gbUpdate",
          attrs: { date: u.date },
          content: blocksPM(u.children),
        })),
      }
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
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] }
}

// ---------- TipTap → AST ----------

function pmTextToInline(nodes: PMNode[] | undefined): Inline[] {
  if (!nodes) return []
  return nodes
    .filter(
      (n) =>
        (n.type === "text" && n.text) ||
        n.type === "gbInlineImage" ||
        n.type === "gbReference" ||
        n.type === "gbAttachment"
    )
    .map((n): Inline => {
      if (n.type === "gbAttachment") {
        const a = n.attrs ?? {}
        return {
          type: "image",
          src: `${ATTACHMENT_SCHEME}${String(a.id ?? "")}`,
          ...(a.name ? { alt: String(a.name) } : {}),
        }
      }
      if (n.type === "gbReference") {
        const a = n.attrs ?? {}
        const kind =
          a.kind === "tag" || a.kind === "codebase" || a.kind === "citation" ? a.kind : "mention"
        return {
          type: "reference",
          kind,
          id: String(a.id ?? ""),
          ...(a.url ? { url: String(a.url) } : {}),
          ...(a.label ? { label: String(a.label) } : {}),
        }
      }
      if (n.type === "gbInlineImage") {
        const a = n.attrs ?? {}
        return {
          type: "image",
          src: String(a.src ?? ""),
          ...(a.alt ? { alt: String(a.alt) } : {}),
          ...(a.width ? { width: String(a.width) } : {}),
          ...(a.height ? { height: String(a.height) } : {}),
          ...(a.link ? { link: String(a.link) } : {}),
        }
      }
      const inline: Inline = { type: "text", text: n.text! }
      for (const mark of n.marks ?? []) {
        if (mark.type === "bold") inline.bold = true
        if (mark.type === "italic") inline.italic = true
        if (mark.type === "strike") inline.strike = true
        if (mark.type === "code") inline.code = true
        if (mark.type === "link") {
          inline.link = String(mark.attrs?.href ?? "")
          if (mark.attrs?.inner) inline.linkInner = true
        }
      }
      if (inline.linkInner && !(inline.bold || inline.italic || inline.strike)) delete inline.linkInner
      return inline
    })
}

function pmCellToInline(cell: PMNode): Inline[] {
  // table cells contain paragraphs; flatten the first one
  return pmTextToInline(cell.content?.[0]?.content)
}

function pmToBlock(n: PMNode): Block | null {
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
        tabs: (n.content ?? []).map((t) => ({
          type: "tab",
          title: String(t.attrs?.title ?? "Tab"),
          children: pmToBlocks(t.content),
        })),
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
        steps: (n.content ?? []).map((s) => ({
          type: "step",
          title: String(s.attrs?.title ?? ""),
          children: pmToBlocks(s.content),
        })),
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
      return {
        type: "content-ref",
        url,
        children: label ? [{ type: "text", text: label, ...(linked ? { link: url } : {}) }] : [],
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
        columns: (n.content ?? []).map((c) => ({ type: "column", children: pmToBlocks(c.content) })),
      }
    case "gbFigure":
      return {
        type: "figure",
        src: String(n.attrs?.src ?? ""),
        alt: String(n.attrs?.alt ?? ""),
        caption: String(n.attrs?.caption ?? ""),
      }
    case "gbMath":
      return { type: "math", formula: String(n.attrs?.formula ?? "") }
    case "gbUpdates":
      return {
        type: "updates",
        format: (n.attrs?.format as string) || null,
        updates: (n.content ?? []).map((u) => ({
          type: "update",
          date: String(u.attrs?.date ?? ""),
          children: pmToBlocks(u.content),
        })),
      }
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
      return {
        type: "list",
        ordered: n.type === "orderedList",
        task,
        items: (n.content ?? []).map((item) => {
          const base: ListItemNode = { type: "listItem", children: pmToBlocks(item.content) }
          if (task) base.checked = !!item.attrs?.checked
          if (!base.children.length) base.children = [{ type: "paragraph", children: [] }]
          return base
        }),
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
      return {
        type: "table",
        header: (head?.content ?? []).map(pmCellToInline),
        rows: body.map((r) => (r.content ?? []).map(pmCellToInline)),
        ...(view ? { view } : {}),
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
  return (nodes ?? []).map(pmToBlock).filter((b): b is Block => b !== null)
}

export function tiptapToAst(doc: PMNode): DocumentNode {
  return { type: "doc", children: pmToBlocks(doc.content) }
}

// docstream writes inline images as `<img src alt />`; attachment chips read
// better (and diff better) as plain markdown images.
const ATTACHMENT_IMG = /<img src="(attachment:[^"\s]+)"(?: alt="([^"]*)")? \/>/g

/**
 * Serialize an editor AST to GitBook markdown, writing attachment chips as
 * `![name](attachment:<id>)`. Use this instead of `serializeMarkdown` for
 * editor output.
 */
export function serializeEditorMarkdown(doc: DocumentNode): string {
  return serializeMarkdown(doc).replace(ATTACHMENT_IMG, (img: string, src: string, alt = "") =>
    // `]` can't be escaped in `![alt]`; such names keep the <img> form.
    alt.includes("]") ? img : `![${alt}](${src})`
  )
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
