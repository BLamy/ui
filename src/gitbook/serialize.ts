import type {
  Block,
  CitationDef,
  ColumnNode,
  ColumnsNode,
  HintNode,
  StepNode,
  StepperNode,
  TabNode,
  TabsNode,
  UpdateNode,
  UpdatesNode,
  CodeBlockNode,
  CommandNode,
  OpenApiOperationNode,
  DefinitionNode,
  DemoInlineFile,
  DemoNode,
  DocumentNode,
  FigureNode,
  Inline,
  ListItemNode,
  ListNode,
  TableNode,
} from "./ast"
import { attr } from "./attrs"
import { normalizeLabel, serializeInline, serializeReference, withDocumentDefinitions } from "./inline"
import { plainText } from "./inline"
import { parseBlocks } from "./parse"
import { taskMarker } from "./tasks"

/** A `{% tag %}…{% endtag %}` container, block or item. */
export type TaggedNode = HintNode | TabsNode | TabNode | StepperNode | StepNode | ColumnsNode | ColumnNode | UpdatesNode | UpdateNode

/** The opening and closing lines serialization writes for a container. */
export function containerTags(b: TaggedNode): [string, string] {
  switch (b.type) {
    case "hint":
      return [`{% hint${attr("style", b.style)} %}`, "{% endhint %}"]
    case "tabs": {
      const attrs = [
        b.title ? attr("title", b.title) : "",
        b.title && b.level && b.level !== 2 ? attr("level", b.level) : "",
        b.sync ? attr("sync", b.sync) : "",
      ].join("")
      return [`{% tabs${attrs} %}`, "{% endtabs %}"]
    }
    case "tab":
      return [`{% tab${attr("title", b.title)} %}`, "{% endtab %}"]
    case "stepper":
      return ["{% stepper %}", "{% endstepper %}"]
    case "step":
      return ["{% step %}", "{% endstep %}"]
    case "columns":
      return ["{% columns %}", "{% endcolumns %}"]
    case "column":
      return ["{% column %}", "{% endcolumn %}"]
    case "updates":
      return [`{% updates${b.format ? attr("format", b.format) : ""} %}`, "{% endupdates %}"]
    case "update":
      return [`{% update${attr("date", b.date)} %}`, "{% endupdate %}"]
  }
}

/** Items live inside a parent container, which a shell must supply. */
const ITEM_PARENT: Partial<Record<TaggedNode["type"], [string, string, string]>> = {
  tab: ["{% tabs %}", "{% endtabs %}", "tabs"],
  step: ["{% stepper %}", "{% endstepper %}", "steps"],
  column: ["{% columns %}", "{% endcolumns %}", "columns"],
  update: ["{% updates %}", "{% endupdates %}", "updates"],
}

/** What a container's tags say, without its content. */
function tagSettings(b: TaggedNode | Block | undefined): string {
  if (!b) return ""
  const { children, tabs, steps, columns, updates, opening, closing, heading, title, ...rest } = b as unknown as Record<string, unknown>
  return canonical(b.type === "step" ? rest : { ...rest, title })
}

/** The container's opening and closing lines: as written while they still say the same, else canonical. */
function tagsFor(b: TaggedNode): [string, string] {
  const [open, close] = containerTags(b)
  if (b.opening === undefined && b.closing === undefined) return [open, close]
  const o = b.opening ?? open
  const c = b.closing ?? close
  const parent = ITEM_PARENT[b.type]
  const text = parent ? `${parent[0]}\n${o}\n${c}\n${parent[1]}` : `${o}\n${c}`
  const [first] = parseBlocks(text.split("\n"))
  const again = parent ? ((first as unknown as Record<string, TaggedNode[]> | undefined)?.[parent[2]]?.[0]) : first
  return again?.type === b.type && tagSettings(again) === tagSettings(b) ? [o, c] : [open, close]
}

/** A step's title heading: as written while it still gives the title, else `### title`. */
function stepHeading(s: StepNode): string {
  if (s.heading !== undefined) {
    const again = parseBlocks(s.heading.split("\n"))
    if (again.length === 1 && again[0].type === "heading" && plainText(again[0].children) === s.title) return s.heading
  }
  return s.title ? `### ${s.title}` : ""
}

/** Footnote definitions of the document being serialized, so positioned ones follow citation edits. */
let documentCitations: ReadonlyMap<string, CitationDef> | null = null

export function serializeMarkdown(doc: DocumentNode): string {
  const citations = new Map((doc.citations ?? []).map((c) => [c.id, c]))
  const placed = new Set<string>()
  const defs = new Map<string, string>()
  walkBlocks(doc.children, (b) => {
    if (b.type !== "definition") return
    if (b.label.startsWith("^")) placed.add(b.label.slice(1))
    else if (!defs.has(normalizeLabel(b.label))) defs.set(normalizeLabel(b.label), b.url)
  })
  const saved = documentCitations
  documentCitations = citations
  try {
    return withDocumentDefinitions(defs, () => {
      const properties = doc.properties
      let out = properties ? `${properties.opening ?? "---"}\n${properties.yaml}${properties.yaml ? "\n" : ""}${properties.closing ?? "---"}\n` : ""
      out += doc.children.map((b, k) => `${blankLines(b, k ? 1 : 0)}${serializeBlock(b)}\n`).join("")
      // Footnote definitions not placed in the document end it, as a group.
      const trailing = (doc.citations ?? []).filter((c) => !placed.has(c.id))
      if (trailing.length) {
        const lines = trailing.map((c) => footnoteDefinition(c.id, c.url, c.label)).join("\n")
        out += `${"\n".repeat(doc.citationsGap ?? (doc.children.length ? 1 : 0))}${lines}\n`
      }
      const text = out.replace(/\s*$/, "") + (doc.end ?? "\n")
      return doc.lineEnding === "\r\n" ? text.replace(/\n/g, "\r\n") : text
    })
  } finally {
    documentCitations = saved
  }
}

function footnoteDefinition(id: string, url: string, label?: string): string {
  return `[^${id}]: ${url}${label ? ` "${label}"` : ""}`
}

/** Visits every block, containers' children included. */
function walkBlocks(blocks: Block[], visit: (b: Block) => void) {
  for (const b of blocks) {
    visit(b)
    switch (b.type) {
      case "hint":
      case "expandable":
      case "blockquote":
        walkBlocks(b.children, visit)
        break
      case "tabs":
        for (const t of b.tabs) walkBlocks(t.children, visit)
        break
      case "stepper":
        for (const s of b.steps) walkBlocks(s.children, visit)
        break
      case "columns":
        for (const c of b.columns) walkBlocks(c.children, visit)
        break
      case "updates":
        for (const u of b.updates) walkBlocks(u.children, visit)
        break
      case "list":
        for (const item of b.items) walkBlocks(item.children, visit)
        break
    }
  }
}

/** The blank lines before a block: `gap` of them (`fallback` by default), as written when recorded. */
function blankLines(b: { gap?: number; blanks?: string[] }, fallback: number): string {
  const gap = b.gap ?? fallback
  if (b.blanks?.length === gap && b.blanks.every((l) => !l.trim())) return b.blanks.map((l) => `${l}\n`).join("")
  return "\n".repeat(gap)
}

/** Blocks separated by their blank lines (default one; none before the first). */
export function serializeBlocks(blocks: Block[]): string {
  return blocks.map((b, k) => `${k ? "\n" : ""}${blankLines(b, k ? 1 : 0)}${serializeBlock(b)}`).join("")
}

interface BodyOptions {
  /** Blank lines before the first child by default. */
  firstGap?: number
  /** Blank lines before the closing line by default. */
  endGap?: number
  /** The children follow another line of the body (a step's title), so the first is a sibling. */
  preceded?: boolean
}

/**
 * A container: its opening line(s), each child after its blank lines, the blank lines before the end, the
 * closing line.
 */
function container(open: string, children: Block[], gapEnd: number | undefined, close: string, o: BodyOptions = {}): string {
  const first = o.preceded ? 1 : (o.firstGap ?? 0)
  const body = children.map((c, k) => `${blankLines(c, k ? 1 : first)}${serializeBlock(c)}\n`).join("")
  return `${open}\n${body}${"\n".repeat(gapEnd ?? o.endGap ?? 0)}${close}`
}

/** Items (tabs, steps, columns, updates) after their blank lines: none before the first, one between. */
function items<T extends { gap?: number }>(list: T[], write: (item: T) => string): string {
  return list.map((it, k) => `${"\n".repeat(it.gap ?? (k ? 1 : 0))}${write(it)}\n`).join("")
}

/** Pads each line holding more than whitespace (`all`: every non-empty line). */
function indent(s: string, pad: string, all = false): string {
  return s
    .split("\n")
    .map((l) => ((all ? l : l.trim()) ? pad + l : l))
    .join("\n")
}

/** Canonical JSON (sorted keys, layout-only fields dropped): do two nodes say the same thing? */
function canonical(value: unknown): string {
  return JSON.stringify(value, (key, v) => {
    if (key === "gap" || key === "gapEnd" || key === "raw" || key === "blanks") return undefined
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)))
    }
    return v
  })
}

/** `raw` if it still parses to (a block equal to) `node`, else `fallback`. */
function reuse(raw: string | undefined, node: Block, fallback: () => string): string {
  if (raw !== undefined) {
    const again = parseBlocks(raw.split("\n"))
    if (again.length === 1 && canonical(again[0]) === canonical(node)) return raw
  }
  return fallback()
}

/** The line `serializeMarkdown` writes for a definition. */
export function definitionLine(b: DefinitionNode): string {
  return `[${b.label}]: ${b.url}${b.title !== undefined && (b.title || !b.label.startsWith("^")) ? ` "${b.title}"` : ""}`
}

/** The `<figure>` written for a figure without usable source lines. */
export function figureMarkdown(b: FigureNode): string {
  const alt = b.alt ? ` alt="${b.alt}"` : ' alt=""'
  const cap = b.caption ? `<figcaption><p>${b.caption}</p></figcaption>` : "<figcaption></figcaption>"
  return `<figure><img src="${b.src}"${alt}>${cap}</figure>`
}

/** The GFM delimiter row written for `columns` columns aligned per `align`. */
export function defaultDelimiterRow(columns: number, align?: TableNode["align"]): string {
  const cell = (k: number) => {
    const a = align?.[k]
    return a === "left" ? ":---" : a === "center" ? ":---:" : a === "right" ? "---:" : "---"
  }
  return `| ${Array.from({ length: columns }, (_, k) => cell(k)).join(" | ")} |`
}

/** Column alignment from a GFM delimiter row. */
export function delimiterAlign(row: string): Array<"left" | "center" | "right" | null> {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => {
      const c = cell.trim()
      const left = c.startsWith(":")
      const right = c.endsWith(":") && c.length > 1
      return left && right ? "center" : left ? "left" : right ? "right" : null
    })
}

/** The info string written after a fence. */
export function fenceInfo(b: CodeBlockNode): string {
  // Line numbers default to on for titled fences, off for untitled ones.
  const numbersByDefault = b.title !== null && b.title !== undefined && b.title !== ""
  const attrs = [
    b.title ? attr("title", b.title) : "",
    b.lineNumbers !== numbersByDefault || b.lineNumbersExplicit ? attr("lineNumbers", b.lineNumbers) : "",
    b.live ? attr("live", true) : "",
    b.entry ? attr("entry", b.entry) : "",
    b.collapsedCodeLines ? attr("collapsedCodeLines", b.collapsedCodeLines) : "",
    b.expandedCodeLines ? attr("expandedCodeLines", b.expandedCodeLines) : "",
  ].join("")
  return `${b.language ?? ""}${b.language ? attrs : attrs.trimStart()}`
}

/** The fence settings a code block says, for comparing a recorded info string with the node. */
function fenceSettings(b: CodeBlockNode): string {
  return canonical([b.language || null, b.title || null, !!b.lineNumbers, !!b.live, b.entry || null, b.collapsedCodeLines ?? null, b.expandedCodeLines ?? null])
}

function serializeCode(b: CodeBlockNode): string {
  if (b.indented && fenceSettings(b) === fenceSettings({ ...b, language: null, title: null, lineNumbers: false })) {
    return indent(b.code, "    ", true)
  }
  // The fence as written (indent, `~~~`, longer runs), unless a content line would close it.
  const written = b.fence?.match(/^([ \t]*)(`{3,}|~{3,})$/)
  const usable = written && !b.code.split("\n").some((l) => l.trim().startsWith(written[2]))
  const open = usable ? b.fence! : "```"
  const chars = open.trim()
  let info = fenceInfo(b)
  if (b.info !== undefined) {
    const again = parseBlocks([`${chars}${b.info}`, chars])[0]
    if (again?.type === "code" && fenceSettings(again) === fenceSettings(b) && !!again.lineNumbersExplicit === !!b.lineNumbersExplicit) info = b.info
  }
  // An unclosed fence (the input ended first) stays unclosed.
  if (b.closingFence === "") return `${open}${info}\n${b.code}`
  const close = b.closingFence !== undefined && b.closingFence.trim().startsWith(chars) ? b.closingFence : open
  return `${open}${info}\n${b.code}\n${close}`
}

function serializeBlock(b: Block): string {
  switch (b.type) {
    case "paragraph":
      return `${b.indent && /^[ \t]*$/.test(b.indent) ? b.indent : ""}${serializeInline(b.children)}`

    case "heading": {
      const inline = serializeInline(b.children)
      if (b.setext && inline) return `${inline}\n${b.setext}`
      return inline ? `${"#".repeat(b.level)} ${inline}` : "#".repeat(b.level)
    }

    case "code":
      return reuse(b.raw, b, () => serializeCode(b))

    case "hint": {
      const [open, close] = tagsFor(b)
      return container(open, b.children, b.gapEnd, close)
    }

    case "tabs": {
      const [open, close] = tagsFor(b)
      const tabs = items(b.tabs, (t) => {
        const [tabOpen, tabClose] = tagsFor(t)
        return container(tabOpen, t.children, t.gapEnd, tabClose)
      })
      return `${open}\n${tabs}${"\n".repeat(b.gapEnd ?? 0)}${close}`
    }

    case "command":
      return reuse(b.raw, b, () => serializeCommand(b))

    case "math":
      return reuse(b.raw, b, () => `$$\n${b.formula}\n$$`)

    case "openapi-operation":
      return reuse(b.raw, b, () => serializeOpenApi(b))

    case "demo":
      return reuse(b.raw, b, () => serializeDemo(b))

    case "expandable": {
      const said = b.opening?.match(/<summary>(.*?)<\/summary>\s*$/i)
      const opening =
        b.opening !== undefined && /^\s*<details>/i.test(b.opening) && (said ? said[1] === b.summary : !b.summary && !/<summary>/i.test(b.opening))
          ? b.opening
          : `<details>\n\n<summary>${b.summary}</summary>`
      const closing = b.closing !== undefined && /^\s*<\/details>\s*$/i.test(b.closing) ? b.closing : "</details>"
      return container(opening, b.children, b.gapEnd, closing, { firstGap: 1, endGap: 1 })
    }

    case "stepper": {
      const [open, close] = tagsFor(b)
      const steps = items(b.steps, (s) => {
        const [stepOpen, stepClose] = tagsFor(s)
        const head = stepHeading(s)
        return container(`${stepOpen}${head ? `\n${head}` : ""}`, s.children, s.gapEnd, stepClose, { preceded: !!head })
      })
      return `${open}\n${steps}${"\n".repeat(b.gapEnd ?? 0)}${close}`
    }

    case "columns": {
      const [open, close] = tagsFor(b)
      const columns = items(b.columns, (c) => {
        const [columnOpen, columnClose] = tagsFor(c)
        return container(columnOpen, c.children, c.gapEnd, columnClose)
      })
      return `${open}\n${columns}${"\n".repeat(b.gapEnd ?? 0)}${close}`
    }

    case "updates": {
      const [open, close] = tagsFor(b)
      const updates = items(b.updates, (u) => {
        const [updateOpen, updateClose] = tagsFor(u)
        return container(updateOpen, u.children, u.gapEnd, updateClose)
      })
      return `${open}\n${updates}${"\n".repeat(b.gapEnd ?? 0)}${close}`
    }

    case "embed": {
      const attrs = [
        attr("url", b.url),
        b.title ? attr("title", b.title) : "",
        b.poster ? attr("poster", b.poster) : "",
        b.autoplay === undefined ? "" : attr("autoplay", b.autoplay),
        b.loop === undefined ? "" : attr("loop", b.loop),
        b.muted === undefined ? "" : attr("muted", b.muted),
        b.controls === undefined ? "" : attr("controls", b.controls),
      ].join("")
      return reuse(b.raw, b, () => `{% embed${attrs} %}`)
    }

    case "content-ref":
      return reuse(b.raw, b, () => `{% content-ref${attr("url", b.url)} %}\n${serializeInline(b.children)}\n{% endcontent-ref %}`)

    case "source-ref": {
      const attrs = [
        attr("mount", b.mount),
        attr("path", b.path),
        attr("export", b.exportName),
        attr("kind", b.kind),
        b.title ? attr("title", b.title) : "",
      ].join("")
      return reuse(b.raw, b, () => `{% source-ref${attrs} %}`)
    }

    case "figure":
      return reuse(b.raw, b, () => figureMarkdown(b))

    case "list": {
      const list = b.items.map((item, idx) => `${idx ? "\n" : ""}${blankLines(item, 0)}${serializeListItem(item, b, idx)}`).join("")
      return b.indent && /^[ \t]*$/.test(b.indent) ? indent(list, b.indent) : list
    }

    case "blockquote":
      return `${serializeBlocks(b.children)}${"\n".repeat(b.gapEnd ?? 0)}`
        .split("\n")
        .map((l, k, all) => (b.markers?.length === all.length ? b.markers[k] + l : l ? `> ${l}` : ">"))
        .join("\n")

    case "divider":
      return b.marker && /^(?:-{3,}|\*{3,}|_{3,})$/.test(b.marker) ? b.marker : "---"

    case "table": {
      if (b.view || b.html) {
        return reuse(b.raw, b, () => {
          const cellHtml = (c: Inline[]) => inlineToHtml(c)
          const head = `<thead><tr>${b.header.map((c) => `<th>${cellHtml(c)}</th>`).join("")}</tr></thead>`
          const body = `<tbody>${b.rows
            .map((r) => `<tr>${r.map((c) => `<td>${cellHtml(c)}</td>`).join("")}</tr>`)
            .join("")}</tbody>`
          return `<table${b.view ? ` data-view="${b.view}"` : ""}>${head}${body}</table>`
        })
      }
      // Pipes inside cells are escaped so they don't break the GFM row (unless a code span wrote them bare).
      const cell = (c: Inline[]) => serializeInline(c, { tableCell: true })
      // An empty cell is written `| |`, as authors do.
      const row = (cells: Inline[][]) => `|${cells.map((c) => ` ${cell(c)} `.replace(/^  $/, " ")).join("|")}|`
      const columns = b.header.length
      const align = b.align?.some((a) => a) ? b.align : undefined
      const recorded = b.delimiterRow
      const sep =
        recorded !== undefined &&
        /^\s*\|[\s:|-]+\|\s*$/.test(recorded) &&
        canonical(delimiterAlign(recorded)) === canonical(Array.from({ length: columns }, (_, k) => align?.[k] ?? null))
          ? recorded
          : defaultDelimiterRow(columns, align)
      // Rows as written (padded columns, no outer pipes…) while they still say the same cells.
      const written = (cells: Inline[][], k: number) => {
        const raw = b.rawRows?.[k]
        if (raw !== undefined) {
          const again = parseBlocks([raw, defaultDelimiterRow(Math.max(cells.length, 1))])[0]
          if (again?.type === "table" && canonical(again.header) === canonical(cells)) return raw
        }
        return row(cells)
      }
      return [written(b.header, 0), sep, ...b.rows.map((r, k) => written(r, k + 1))].join("\n")
    }

    case "raw":
      return b.markdown

    case "definition": {
      // A footnote definition follows the document's citation, which the editor may have changed.
      const cite = b.label.startsWith("^") ? documentCitations?.get(b.label.slice(1)) : undefined
      const node: DefinitionNode = cite
        ? { type: "definition", label: b.label, url: cite.url, ...(cite.label ? { title: cite.label } : {}), ...(b.raw ? { raw: b.raw } : {}) }
        : b
      return reuse(node.raw, node, () => definitionLine(node))
    }
  }
}

function serializeCommand(b: CommandNode): string {
  const attrs = [
    ...(["pnpm", "yarn", "bun"] as const).map((pm) => (b.overrides?.[pm] ? attr(pm, b.overrides[pm]) : "")),
    b.sync && b.sync !== "pm" ? attr("sync", b.sync) : "",
  ].join("")
  return b.command.includes("\n")
    ? `{% command${attrs} %}\n${b.command}\n{% endcommand %}`
    : `{% command${attrs} %}${b.command}{% endcommand %}`
}

function serializeDemo(b: DemoNode): string {
  const attrs = [
    attr("src", b.src),
    b.title ? attr("title", b.title) : "",
    b.description ? attr("description", b.description) : "",
    b.height ? attr("height", b.height) : "",
    b.layout ? attr("layout", b.layout) : "",
    b.variants?.length
      ? attr("variants", b.variants.map((v) => (v.label === v.id ? v.id : `${v.id}:${v.label}`)).join(","))
      : "",
    b.viewport ? attr("viewport", b.viewport) : "",
    b.entry ? attr("entry", b.entry) : "",
    b.status ? attr("status", b.status) : "",
    b.bleed === undefined ? "" : attr("bleed", b.bleed),
    b.className ? attr("className", b.className) : "",
    b.surface ? attr("surface", b.surface) : "",
    b.variantsWidth ? attr("variantsWidth", b.variantsWidth) : "",
  ].join("")
  return `{% demo${attrs} %}${serializeDemoFiles(b)}`
}

function serializeOpenApi(b: OpenApiOperationNode): string {
  const attrs = [
    b.spec ? attr("spec", b.spec) : "",
    b.path ? attr("path", b.path) : "",
    b.method ? attr("method", b.method) : "",
  ].join("")
  const inner = b.specUrl ? `\n[${b.label || b.spec || "OpenAPI"}](${b.specUrl})` : ""
  return `{% openapi-operation${attrs} %}${inner}\n{% endopenapi-operation %}`
}

function inlineToHtml(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      if (n.type === "image") {
        const img = `<img src="${n.src}"${n.alt ? ` alt="${n.alt}"` : ""}>`
        return n.link ? `<a href="${n.link}">${img}</a>` : img
      }
      // HTML card tables round-trip through htmlToInlineMd, which strips
      // tags — plain markers are the only representation that survives.
      if (n.type === "reference") return serializeReference(n)
      let s = n.text
      if (n.code) s = `<code>${s}</code>`
      if (n.bold) s = `<strong>${s}</strong>`
      if (n.italic) s = `<em>${s}</em>`
      if (n.link) s = `<a href="${n.link}">${s}</a>`
      return s
    })
    .join("")
}

function serializeListItem(item: ListItemNode, list: ListNode, idx: number): string {
  const marker = item.marker ?? (list.ordered ? `${(list.start ?? 1) + idx}${list.delimiter ?? "."}` : (list.bullet ?? "-"))
  const check = list.task ? `[${taskMarker(item)}] ` : ""
  const [first, ...rest] = item.children
  const firstText = first?.type === "paragraph" ? serializeInline(first.children) : first ? serializeBlock(first) : ""
  const restText = rest.length ? "\n" + indent(serializeBlocks(rest), " ".repeat(item.indent ?? 2)) : ""
  return `${marker}${" ".repeat(item.pad ?? 1)}${check}${firstText}${restText}`
}

/** A fence longer than any backtick run in the content, so nested fences survive. */
export function fenceFor(content: string): string {
  let longest = 2
  for (const m of content.matchAll(/`+/g)) longest = Math.max(longest, m[0].length)
  return "`".repeat(longest + 1)
}

/** One inline demo file as a titled fence. */
export function serializeDemoFile(file: DemoInlineFile): string {
  const fence = fenceFor(file.content)
  return `${fence}${file.language ?? ""}${attr("title", file.path)}\n${file.content}\n${fence}`
}

/** The body of a block-form `{% demo %}`: files as titled fences, then `{% enddemo %}`. Empty without files. */
function serializeDemoFiles(node: DemoNode): string {
  if (!node.files?.length) return ""
  return `\n${node.files.map(serializeDemoFile).join("\n")}\n{% enddemo %}`
}
