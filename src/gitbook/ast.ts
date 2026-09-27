// AST for GitBook-flavored markdown. This is the single source of truth that
// the parser, serializer, TipTap converters, and docs renderer all share.

export type HintStyle = "info" | "success" | "warning" | "danger"

export interface TextNode {
  type: "text"
  text: string
  bold?: boolean
  italic?: boolean
  strike?: boolean
  code?: boolean
  link?: string
  /**
   * The link sits inside the emphasis (`**[x](url)**`) rather than around it
   * (`[**x**](url)`, the default). Kept so the source round-trips byte-for-byte.
   */
  linkInner?: true
}

/** Inline HTML image, optionally wrapped in a link — GitHub README badge style. */
export interface InlineImageNode {
  type: "image"
  src: string
  alt?: string
  width?: string
  height?: string
  link?: string
}

export type ReferenceKind = "mention" | "tag" | "codebase" | "citation"

/**
 * Inline reference chip: `@mention`, `#tag`, or footnote-style citation `[^id]`.
 * `id` carries no sigil. Citations resolve `url`/`label` from their
 * `[^id]: url "Label"` definition at parse time when one exists.
 */
export interface ReferenceNode {
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

export interface ParagraphNode {
  type: "paragraph"
  children: Inline[]
}

export interface HeadingNode {
  type: "heading"
  level: 1 | 2 | 3 | 4 | 5 | 6
  children: Inline[]
}

export interface CodeBlockNode {
  type: "code"
  language: string | null
  title: string | null
  lineNumbers: boolean
  code: string
  /** Run a React/JSX/TSX entry file in the optional almost-node preview. */
  live?: boolean
  /** Project-relative entry file used by a live preview. */
  entry?: string | null
  /** Source lines visible before an expandable code preview is opened. */
  collapsedCodeLines?: number
  /** Maximum source lines visible before expanded code scrolls. */
  expandedCodeLines?: number
}

export interface HintNode {
  type: "hint"
  style: HintStyle
  children: Block[]
}

export interface TabNode {
  type: "tab"
  title: string
  children: Block[]
}

export interface TabsNode {
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
export interface CommandNode {
  type: "command"
  /** The npm / npx command (may span lines). */
  command: string
  /** Explicit commands for other managers, used verbatim instead of the derived ones. */
  overrides?: Partial<Record<Exclude<PackageManager, "npm">, string>>
  /** Sync key. Omitted means `"pm"`. */
  sync?: string
}

export interface ExpandableNode {
  type: "expandable"
  summary: string
  children: Block[]
}

export interface StepNode {
  type: "step"
  title: string
  children: Block[]
}

export interface StepperNode {
  type: "stepper"
  steps: StepNode[]
}

export interface EmbedNode {
  type: "embed"
  url: string
  title?: string
  autoplay?: boolean
  loop?: boolean
  muted?: boolean
  controls?: boolean
  poster?: string
}

export interface ContentRefNode {
  type: "content-ref"
  url: string
  children: Inline[]
}

export type SourceReferenceKind = "component" | "story"

/**
 * A reference to an export in a real source file. The source file remains the
 * authority; Markdown only stores the composition and presentation metadata.
 */
export interface SourceRefNode {
  type: "source-ref"
  /** Name of the directory mounted by the Docstream Vite plugin. */
  mount: string
  /** POSIX-style path relative to the mounted source directory. */
  path: string
  /** Named export to render. Defaults to `default`. */
  exportName: string
  kind: SourceReferenceKind
  title?: string
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
 * `meta.json`. The block form carries the files inline so the Markdown renders
 * anywhere, resolver or not:
 *
 *     {% demo src="composer/scroll-fab" title="Scroll → FAB" %}
 *     ```tsx title="index.tsx"
 *     …
 *     ```
 *     {% enddemo %}
 */
export interface DemoNode {
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
  /** Files carried inline by the block form, in document order. */
  files?: DemoInlineFile[]
  /**
   * Set while streaming when the block's `{% enddemo %}` has not arrived yet: the
   * files may still be growing, so renderers show code but hold off running it.
   * Never serialized.
   */
  open?: true
}

export interface ColumnNode {
  type: "column"
  children: Block[]
}

export interface ColumnsNode {
  type: "columns"
  columns: ColumnNode[]
}

export interface FigureNode {
  type: "figure"
  src: string
  alt: string
  caption: string
}

export interface ListItemNode {
  type: "listItem"
  children: Block[]
  checked?: boolean // present only in task lists
}

export interface ListNode {
  type: "list"
  ordered: boolean
  task: boolean
  items: ListItemNode[]
}

export interface BlockquoteNode {
  type: "blockquote"
  children: Block[]
}

export interface DividerNode {
  type: "divider"
}

export interface TableNode {
  type: "table"
  header: Inline[][]
  rows: Inline[][][]
  /** GitBook table view, e.g. "cards" for <table data-view="cards"> */
  view?: string
}

export interface UpdateNode {
  type: "update"
  date: string
  children: Block[]
}

export interface UpdatesNode {
  type: "updates"
  format: string | null
  updates: UpdateNode[]
}

export interface OpenApiOperationNode {
  type: "openapi-operation"
  spec: string
  path: string
  method: string
  specUrl: string
  label: string
}

export interface MathNode {
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

export interface DocumentNode {
  type: "doc"
  children: Block[]
  /** Footnote citation definitions, in definition order. */
  citations?: CitationDef[]
}

export const text = (t: string, marks: Partial<Omit<TextNode, "type" | "text">> = {}): TextNode => ({
  type: "text",
  text: t,
  ...marks,
})
