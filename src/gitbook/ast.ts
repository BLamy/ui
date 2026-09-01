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

export type ReferenceKind = "mention" | "tag" | "citation"

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
  | ExpandableNode
  | StepperNode
  | EmbedNode
  | ContentRefNode
  | SourceRefNode
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
