// AST for GitBook-flavored markdown. This is the single source of truth that
// the parser, serializer, TipTap converters, and docs renderer all share.

export type HintStyle = "info" | "success" | "warning" | "danger"

/**
 * Formatting every inline carries — text runs, chips and inline images alike, so emphasis and links can span
 * them (`**ask @brett**`, `*see ![i](s)*`, `[![badge](b.svg)](url)`) — plus how the source spelled it.
 */
export interface InlineMarks {
  bold?: boolean
  italic?: boolean
  strike?: boolean
  link?: string
  /**
   * The link sits inside the emphasis (`**[x](url)**`) rather than around it
   * (`[**x**](url)`, the default). Kept so the source round-trips byte-for-byte.
   */
  linkInner?: true
  /**
   * How the source spelled this inline's formatting, outermost → innermost, when that differs from the default
   * output (`_italic_`, `**bold**`, `~~strike~~`, link around its emphasis, bare autolinks). Each entry is an
   * emphasis marker, or a link form (see {@link LinkForm}). E.g. `**_x_**` → `["**", "_"]`, `***x***` →
   * `["*", "**"]`, `*x*` → `["*"]`, `*a *b* c*` → `["*", "*"]` for `b`.
   *
   * A hint only — the boolean marks and `link` stay authoritative: entries for marks the run no longer has are
   * ignored, marks it has without an entry get the default spelling and position. Absent on runs that
   * serialize the default way and on programmatically created nodes.
   */
  delims?: InlineDelimiter[]
  /** The link's title as written between the quotes: `[x](url "title")`. */
  linkTitle?: string
  /**
   * The reference label of a reference-style link, as written: `ref` for `[text][ref]`, and the link text
   * for the collapsed `[text][]` and shortcut `[text]` forms.
   */
  linkRef?: string
  /** The opening tag of an inline HTML link as written (`<a href="…" target="_blank">`). */
  linkTag?: string
  /** The closing tag of an inline HTML link, when not `</a>` (`</A>`). */
  linkTagEnd?: string
  /**
   * Link identity: set on the runs of a link that directly follows another link to the same target
   * (`[a](u)[b](u)`), so the two stay distinct instead of merging into one. Runs of one link share it.
   */
  linkId?: number
}

export interface TextNode extends InlineMarks {
  type: "text"
  text: string
  code?: boolean
  /**
   * The source wrote every character of this run backslash-escaped (`snake\_case` → `snake`, `_` escaped,
   * `case`). Only ASCII punctuation can be escaped. Kept so author escapes survive even where they aren't
   * needed; the text itself is the literal characters.
   */
  escaped?: true
  /**
   * Code span in a GFM table cell: offsets (in `text`) of the `|` characters the source wrote bare instead
   * of as `\|`. Serialization escapes every other pipe.
   */
  barePipes?: number[]
  /** A code span's backtick count as written, when longer than serialization needs (```` ```x``` ````). */
  ticks?: number
}

/** An emphasis marker as written in the source. */
export type EmphasisDelimiter = "**" | "__" | "*" | "_" | "~~"
/**
 * How a link is written: `"link"` `[x](url)`, `"<>"` `<url>`, `"url"` a bare autolink, `"ref"` `[x][label]`,
 * `"collapsed"` `[x][]`, `"shortcut"` `[x]` (the last three resolved through a `[label]: url` definition),
 * `"html"` `<a href="url">x</a>`.
 */
export type LinkForm = "link" | "<>" | "url" | "ref" | "collapsed" | "shortcut" | "html"
/** An entry of {@link InlineMarks.delims}: an emphasis marker or a link form. */
export type InlineDelimiter = EmphasisDelimiter | LinkForm

/**
 * Inline image: `![alt](src "title")` (`syntax: "markdown"`), or HTML `<img …>` / `<a href><img …></a>`
 * (GitHub README badge style, the default).
 *
 * `link` without a link form in `delims` is the HTML `<a href>` around the `<img>`; with one
 * (`[![a](s)](url)`) it is an ordinary link mark that may span neighbouring text.
 */
export interface InlineImageNode extends InlineMarks {
  type: "image"
  src: string
  alt?: string
  width?: string
  height?: string
  /** `![alt](src "title")`'s title, as written between the quotes. */
  title?: string
  /** Written as Markdown `![alt](src)`. Absent: HTML `<img>`. */
  syntax?: "markdown"
  /**
   * A Markdown image whose source comes from a definition: `![alt][label]` (`"ref"`), `![alt][]`
   * (`"collapsed"`) or `![alt]` (`"shortcut"`), with `srcRef` the label as written.
   */
  srcForm?: "ref" | "collapsed" | "shortcut"
  srcRef?: string
  /**
   * The HTML as written (`<img …>`, or `<a href><img …></a>` for a linked image). Serialization reuses it
   * while it still says the same src / alt / width / height / link; otherwise it writes fresh HTML.
   */
  html?: string
}

export type ReferenceKind = "mention" | "tag" | "codebase" | "citation"

/**
 * Inline reference chip: `@mention`, `#tag`, or footnote-style citation `[^id]`.
 * `id` carries no sigil. Citations resolve `url`/`label` from their
 * `[^id]: url "Label"` definition at parse time when one exists.
 *
 * The inherited `link` is a link *around* the chip (`[@brett](url)`); `url` is the citation's target.
 */
export interface ReferenceNode extends InlineMarks {
  type: "reference"
  kind: ReferenceKind
  id: string
  url?: string
  label?: string
}

/** A footnote citation definition (`[^id]: url "Label"`), collected doc-level. */
export interface CitationDef {
  id: string
  url: string
  label?: string
}

export type Inline = TextNode | InlineImageNode | ReferenceNode

/**
 * Layout the source used around a block, recorded only where it differs from the serializer's default so
 * pages round-trip byte-for-byte.
 */
export interface BlockSpacing {
  /**
   * Blank lines before this block (or tab / step / column / update / list item): by default 1 between
   * siblings and 0 before the first child of a container (1 after an expandable's `<summary>`).
   */
  gap?: number
  /** Those blank lines as written, when some hold whitespace. */
  blanks?: string[]
}

/** A `{% tag %}` container's opening and closing lines as written, reused while they still say the same. */
export interface TagLines {
  /** The opening tag line, when not the one serialization writes (quote style, spacing, extra attributes). */
  opening?: string
  /** The closing tag line, when not the canonical `{% endtag %}` ("" when the input ended first). */
  closing?: string
}

/** A block's source lines as written, where they aren't what serialization writes; reused while they still parse to the same block. */
export interface RawSource {
  raw?: string
}

/** Spacing inside a container, before its closing line. */
export interface ContainerSpacing extends BlockSpacing {
  /** Blank lines between the last child and the closing tag (default 0; 1 in an expandable). */
  gapEnd?: number
}

export interface ParagraphNode extends BlockSpacing {
  type: "paragraph"
  children: Inline[]
  /** Whitespace before the paragraph's first line, as written (continuation lines keep theirs in the text). */
  indent?: string
}

export interface HeadingNode extends BlockSpacing {
  type: "heading"
  level: 1 | 2 | 3 | 4 | 5 | 6
  children: Inline[]
  /** A setext heading's underline as written (`===`, `---`); absent for `#` headings. */
  setext?: string
}

export interface CodeBlockNode extends BlockSpacing {
  type: "code"
  language: string | null
  title: string | null
  /**
   * Show line numbers. Defaults (when the fence doesn't say) to on for titled fences and
   * off for untitled ones; `lineNumbers="true"` / `"false"` overrides.
   */
  lineNumbers: boolean
  /**
   * The source wrote `lineNumbers` (or `showLineNumbers`) explicitly: the serializer keeps
   * the attribute even when it matches the default, so pages round-trip byte-for-byte.
   */
  lineNumbersExplicit?: boolean
  code: string
  /** Run a React/JSX/TSX entry file in the optional almost-node preview. */
  live?: boolean
  /** Project-relative entry file used by a live preview. */
  entry?: string | null
  /** Source lines visible before an expandable code preview is opened. */
  collapsedCodeLines?: number
  /** Maximum source lines visible before expanded code scrolls. */
  expandedCodeLines?: number
  /** The opening fence as written when not ```` ``` ```` (`~~~`, ````` ```` `````). */
  fence?: string
  /** The info string as written after the fence, when it isn't the one serialization writes. */
  info?: string
  /** The closing fence line as written, when it isn't the opening fence ("" when the input ended first). */
  closingFence?: string
  /** An indented (four-space) code block rather than a fence. */
  indented?: true
  /** The block as written when it isn't a plain fence (a `{% code %}` wrapper), reused while it still says the same. */
  raw?: string
}

export interface HintNode extends ContainerSpacing, TagLines {
  type: "hint"
  style: HintStyle
  children: Block[]
}

export interface TabNode extends ContainerSpacing, TagLines {
  type: "tab"
  title: string
  children: Block[]
}

export interface TabsNode extends ContainerSpacing, TagLines {
  type: "tabs"
  tabs: TabNode[]
  /**
   * Sync group (`{% tabs sync="pm" %}`). Every tab set with the same key follows
   * the reader's last choice (matched by tab title), remembered across pages.
   */
  sync?: string
  /**
   * Section title (`{% tabs title="Installation" %}`). The tab set renders as a
   * section: this title as a heading (with an anchor id), the tab switch as pill
   * tabs right-aligned in that header, and the active tab's blocks below.
   */
  title?: string
  /** Heading level of `title` (`level="3"`). Defaults to 2. */
  level?: 2 | 3 | 4
}

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun"

/**
 * A package-manager command box: `{% command %}npm install x{% endcommand %}`.
 * The author writes one canonical npm / npx command; renderers derive the pnpm,
 * yarn and bun forms (see `packageManagerCommands`), unless overridden per
 * manager (`pnpm="…"`). The reader's manager is synced page-wide (and across
 * pages) under `sync` — `"pm"` by default, the same key install `{% tabs %}` use.
 */
export interface CommandNode extends BlockSpacing, RawSource {
  type: "command"
  /** The npm / npx command (may span lines). */
  command: string
  /** Explicit commands for other managers, used verbatim instead of the derived ones. */
  overrides?: Partial<Record<Exclude<PackageManager, "npm">, string>>
  /** Sync key. Omitted means `"pm"`. */
  sync?: string
}

export interface ExpandableNode extends ContainerSpacing {
  /** The closing line, when not `</details>`. */
  closing?: string
  type: "expandable"
  summary: string
  children: Block[]
  /**
   * The lines from `<details>` through `</summary>` as written, when not `<details>`, a blank line,
   * `<summary>…</summary>`. Reused while they still say the same summary.
   */
  opening?: string
}

export interface StepNode extends ContainerSpacing, TagLines {
  type: "step"
  title: string
  children: Block[]
  /**
   * The title heading as written (and any blank lines before it), when not `### title` — `## Title`,
   * `### **Bold** title`. Reused while it still gives the same title.
   */
  heading?: string
}

export interface StepperNode extends ContainerSpacing, TagLines {
  type: "stepper"
  steps: StepNode[]
}

export interface EmbedNode extends BlockSpacing {
  type: "embed"
  url: string
  title?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  controls?: boolean
  poster?: string
  /** The tag as written (with its `{% endembed %}`), reused while it still says the same. */
  raw?: string
}

export interface ContentRefNode extends BlockSpacing {
  type: "content-ref"
  url: string
  children: Inline[]
  /** The block as written when it isn't the canonical `{% content-ref %}` (a `{% file %}` tag), reused while it still says the same. */
  raw?: string
}

export type SourceReferenceKind = "component" | "story"

/**
 * A reference to an export in a real source file. The source file remains the
 * authority; Markdown only stores the composition and presentation metadata.
 */
export interface SourceRefNode extends BlockSpacing {
  type: "source-ref"
  /** Name of the directory mounted by the Docstream Vite plugin. */
  mount: string
  /** POSIX-style path relative to the mounted source directory. */
  path: string
  /** Named export to render. Defaults to `default`. */
  exportName: string
  kind: SourceReferenceKind
  title?: string
  /** The tag as written (`{% component … %}`, an end tag), reused while it still says the same. */
  raw?: string
}

export type DemoLayout = "auto" | "single" | "multi"
export type DemoViewport = "desktop" | "tablet" | "phone"

export interface DemoVariantOption {
  id: string
  label: string
}

/** One source file carried inline by a `{% demo %}` block (a titled fence). */
export interface DemoInlineFile {
  /** Path relative to the demo folder, from the fence's `title` (`index.tsx`, `parts/Card.tsx`). */
  path: string
  content: string
  /** The fence's info-string language, when it has one. */
  language?: string
}

/**
 * A live demo: `{% demo src="<page>/<example>" %}`. With a host `DemoResolver`
 * that knows `src`, the example folder is the authority for the component, its
 * source files and its defaults; attributes here override the folder's
 * `meta.json` field by field (tag attribute first, then `meta.json`, then the built-in
 * default) — including the look attributes `status`, `bleed`, `className`, `surface` and
 * `variantsWidth`, which Copy page writes so the block renders the same without the resolver.
 * The block form carries the files inline so the Markdown renders anywhere, resolver
 * or not:
 *
 *     {% demo src="composer/scroll-fab" title="Scroll → FAB" %}
 *     ```tsx title="index.tsx"
 *     …
 *     ```
 *     {% enddemo %}
 */
export interface DemoNode extends BlockSpacing, RawSource {
  type: "demo"
  /** `<page>/<example>` folder id understood by the host's resolver. */
  src: string
  title?: string
  description?: string
  /** Preview height, kept verbatim (`"420"`, `"60vh"`, `"auto"`). */
  height?: string
  layout?: DemoLayout
  /** `variants="full:Full,compact:Compact"`. */
  variants?: DemoVariantOption[]
  /** Initial preview viewport for the multi-file viewer. */
  viewport?: DemoViewport
  /** Entry file among the inline files (`entry="App.tsx"`). Defaults to the first file. */
  entry?: string
  /** Short status shown in the demo header (`status="Live"`). */
  status?: string
  /** Drop the padded preview surface (`bleed="true"`) for demos with their own full-bleed frame. */
  bleed?: boolean
  /** Extra class on the preview canvas (`className="brand-surface"`). */
  className?: string
  /**
   * Inline style for the preview canvas as CSS declarations, kept verbatim:
   * `surface="background: var(--brand-50); --demo-gap: 12px"`.
   */
  surface?: string
  /** Width of the variant switch, kept verbatim (`"240"`, `"16rem"`). */
  variantsWidth?: string
  /** Files carried inline by the block form, in document order. */
  files?: DemoInlineFile[]
  /**
   * Set while streaming when the block's `{% enddemo %}` has not arrived yet: the
   * files may still be growing, so renderers show code but hold off running it.
   * Never serialized.
   */
  open?: true
}

export interface ColumnNode extends ContainerSpacing, TagLines {
  type: "column"
  children: Block[]
}

export interface ColumnsNode extends ContainerSpacing, TagLines {
  type: "columns"
  columns: ColumnNode[]
}

export interface FigureNode extends BlockSpacing {
  type: "figure"
  src: string
  alt: string
  caption: string
  /** `![alt](src "title")`'s title. */
  title?: string
  /**
   * The line(s) as written (`![alt](src)`, `<img …>`, `<figure>…</figure>`). Serialization reuses them while
   * they still parse to the same src / alt / caption / title; otherwise it writes a `<figure>`.
   */
  raw?: string
}

export interface ListItemNode extends ContainerSpacing {
  type: "listItem"
  children: Block[]
  checked?: boolean // present only in task lists
  /** Extended task state. Omitted for ordinary `[ ]` / `[x]` items for backwards compatibility. */
  state?: TaskState
  /** The item's marker as written (`*`, `3.`), when it isn't the one its list's pattern gives it. */
  marker?: string
  /** Spaces between the marker and the content (default 1). */
  pad?: number
  /** Indent of the item's continuation lines, relative to its marker (default 2). */
  indent?: number
  /** A checked task written `[X]`. */
  checkMark?: "X"
}

export type TaskState = "pending" | "in-progress" | "implemented" | "blocked" | "parked" | "refuted" | "verified" | "cancelled"

export interface ListNode extends BlockSpacing {
  type: "list"
  ordered: boolean
  task: boolean
  items: ListItemNode[]
  /** Bullet marker of an unordered list (default `-`). */
  bullet?: "*" | "+"
  /** Number of an ordered list's first item (default 1). */
  start?: number
  /** Ordered-list delimiter (default `.`). */
  delimiter?: ")"
  /** Whitespace before the list's markers, as written. */
  indent?: string
}

export interface BlockquoteNode extends ContainerSpacing {
  type: "blockquote"
  children: Block[]
  /** Each line's `>` prefix as written (indent, spacing), when not `> ` (`>` on empty lines). */
  markers?: string[]
}

export interface DividerNode extends BlockSpacing {
  type: "divider"
  /** The rule as written when not `---` (`***`, `___`, `-----`). */
  marker?: string
}

export interface TableNode extends BlockSpacing {
  type: "table"
  header: Inline[][]
  rows: Inline[][][]
  /** GitBook table view, e.g. "cards" for <table data-view="cards"> */
  view?: string
  /** Written as an HTML `<table>` (without a view). */
  html?: true
  /** Column alignment from the delimiter row (`:---`, `:---:`, `---:`); null = default. */
  align?: Array<"left" | "center" | "right" | null>
  /** The delimiter row as written (`|:--|--:|`), reused while it still says the same `align`. */
  delimiterRow?: string
  /** An HTML table as written, reused while it still parses to the same cells. */
  raw?: string
  /** GFM rows as written (header first), each reused while it still parses to the same cells. */
  rawRows?: string[]
}

export interface UpdateNode extends ContainerSpacing, TagLines {
  type: "update"
  date: string
  children: Block[]
}

export interface UpdatesNode extends ContainerSpacing, TagLines {
  type: "updates"
  format: string | null
  updates: UpdateNode[]
}

export interface OpenApiOperationNode extends BlockSpacing, RawSource {
  type: "openapi-operation"
  spec: string
  path: string
  method: string
  specUrl: string
  label: string
}

/**
 * A reference-style link definition, `[label]: url "title"`, where the source put it. Links written
 * `[text][label]`, `[text][]` or `[label]` resolve through it.
 */
export interface DefinitionNode extends BlockSpacing {
  type: "definition"
  /** The label as written (matched case-insensitively). */
  label: string
  url: string
  title?: string
  /** The line as written, reused while it still says the same label / url / title. */
  raw?: string
}

/**
 * A line docstream keeps verbatim but doesn't model — an unknown `{% tag %}` (GitBook tags from other
 * integrations). Renders nothing; serialized as written.
 */
export interface RawNode extends BlockSpacing {
  type: "raw"
  markdown: string
}

export interface MathNode extends BlockSpacing, RawSource {
  type: "math"
  formula: string
}

export type Block =
  | ParagraphNode
  | HeadingNode
  | CodeBlockNode
  | HintNode
  | TabsNode
  | CommandNode
  | ExpandableNode
  | StepperNode
  | EmbedNode
  | ContentRefNode
  | SourceRefNode
  | DemoNode
  | ColumnsNode
  | FigureNode
  | ListNode
  | BlockquoteNode
  | DividerNode
  | TableNode
  | MathNode
  | UpdatesNode
  | OpenApiOperationNode
  | DefinitionNode
  | RawNode

/** YAML frontmatter, kept separately from the document body. Comments, key order and quoting survive edits. */
export interface DocumentPropertiesNode {
  /** YAML between the delimiters, using the document's normalized line endings. */
  yaml: string
  /** Opening delimiter as written (including an optional BOM). Defaults to `---`. */
  opening?: string
  /** Closing delimiter as written (`---` or `...`). Defaults to `---`. */
  closing?: string
}

export interface DocumentNode {
  type: "doc"
  children: Block[]
  /** First-party document properties from YAML frontmatter. */
  properties?: DocumentPropertiesNode
  /** Footnote citation definitions, in definition order. */
  citations?: CitationDef[]
  /** Blank lines before the trailing footnote definitions (default 1). */
  citationsGap?: number
  /** Line ending of the source when it used `\r\n` throughout. */
  lineEnding?: "\r\n"
  /** What the source ended with after its last line, when more than a single newline (`"\n\n"`). */
  end?: string
}

export const text = (t: string, marks: Partial<Omit<TextNode, "type" | "text">> = {}): TextNode => ({
  type: "text",
  text: t,
  ...marks,
})
