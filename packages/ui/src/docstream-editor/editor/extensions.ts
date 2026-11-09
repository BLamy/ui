import StarterKit from "@tiptap/starter-kit"
import Code from "@tiptap/extension-code"
import Placeholder from "@tiptap/extension-placeholder"
import { TaskList } from "@tiptap/extension-list"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { Extension, Mark, getSchema, type AnyExtension } from "@tiptap/core"
import type { Schema } from "@tiptap/pm/model"
import { GbCodeBlock, gitbookNodes } from "./nodes"
import { SlashMenu, createSlashMenu, type SlashItem } from "./slash-menu"
import { createReferenceSuggestion, type ReferenceSource } from "./reference-menu"
import { GbDocumentProperties } from "./document-properties"
import { GbTaskItem } from "./task-item"

// Carries GitBook's data-view (e.g. "cards") and the GFM column alignment through the editor untouched.
export const GbTable = Table.extend({
  addAttributes() {
    return { ...this.parent?.(), view: { default: null }, align: { default: null, rendered: false } }
  },
})

/**
 * Inline code that coexists with link, bold, italic and strike. TipTap's code mark
 * excludes every other mark (`excludes: "_"`), so Markdown such as
 * ``[`@brett_lamy/ui`](url)`` or ``**bold `x` text**`` — which docstream parses into one
 * text run with both marks — failed the schema ("Invalid collection of marks for node
 * text: link,code") and dropped the whole paste. Docstream serializes every combination
 * back byte-for-byte.
 */
export const GbCode = Code.extend({
  excludes: "",
})

/**
 * `inner` on the link mark: the link sits inside its emphasis (`**[x](url)**`)
 * rather than around it (`[**x**](url)`). Kept so pasted Markdown round-trips
 * byte-for-byte; newly created links default to the outer form.
 */
export const GbLinkInner = Extension.create({
  name: "gbLinkInner",
  addGlobalAttributes() {
    return [
      {
        types: ["link"],
        attributes: {
          inner: {
            default: null,
            parseHTML: (element) => (element.hasAttribute("data-link-inner") ? true : null),
            renderHTML: (attributes) => (attributes.inner ? { "data-link-inner": "" } : {}),
          },
        },
      },
    ]
  },
})

/**
 * `delim` / `depth` on bold, italic, strike and link marks: how the Markdown spelled the run — its marker
 * (`*` vs `_`, `**` vs `__`, the link form `link` / `<>` / `url`) and its nesting position (0 = outermost).
 * Set only on runs whose spelling differs from docstream's default (docstream `TextNode.delims`), so
 * `***x***`, `**_x_**` and `*italic*` round-trip byte-for-byte. Marks added in the editor carry neither and
 * get the default spelling.
 */
export const GbMarkSpelling = Extension.create({
  name: "gbMarkSpelling",
  addGlobalAttributes() {
    return [
      {
        types: ["bold", "italic", "strike", "link"],
        attributes: {
          delim: {
            default: null,
            parseHTML: (element) => element.getAttribute("data-md-delim"),
            renderHTML: (attributes) => (attributes.delim ? { "data-md-delim": attributes.delim } : {}),
          },
          depth: {
            default: null,
            parseHTML: (element) => {
              const depth = element.getAttribute("data-md-depth")
              return depth === null || depth === "" || Number.isNaN(Number(depth)) ? null : Number(depth)
            },
            renderHTML: (attributes) =>
              typeof attributes.depth === "number" ? { "data-md-depth": String(attributes.depth) } : {},
          },
          // Further occurrences of the same mark in the run's spelling — `*a *b* c*` nests italic in
          // italic, which ProseMirror holds as one mark: `[[depth, delim], …]`.
          more: jsonAttribute("data-md-more", "more"),
        },
      },
    ]
  },
})

/** A JSON-valued attribute `key`, kept in the editor's HTML (clipboard) as `name='…'`. */
function jsonAttribute(name: string, key: string) {
  return {
    default: null,
    keepOnSplit: false,
    parseHTML: (element: HTMLElement) => {
      const value = element.getAttribute(name)
      if (!value) return null
      try {
        return JSON.parse(value) as unknown
      } catch {
        return null
      }
    },
    renderHTML: (attributes: Record<string, unknown>) => {
      const value = attributes[key]
      return value === null || value === undefined ? {} : { [name]: JSON.stringify(value) }
    },
  }
}

/** Every node that holds Markdown layout docstream records (blocks, list items, container items, the doc). */
const LAYOUT_NODES = [
  "doc",
  "paragraph",
  "heading",
  "codeBlock",
  "blockquote",
  "bulletList",
  "orderedList",
  "taskList",
  "listItem",
  "taskItem",
  "horizontalRule",
  "table",
  "gbHint",
  "gbTabs",
  "gbTab",
  "gbExpandable",
  "gbStepper",
  "gbStep",
  "gbEmbed",
  "gbContentRef",
  "gbSourceRef",
  "gbDemo",
  "gbCommand",
  "gbColumns",
  "gbColumn",
  "gbFigure",
  "gbMath",
  "gbUpdates",
  "gbUpdate",
  "gbOpenapi",
  "gbDefinition",
  "gbRaw",
  "gbInlineImage",
  "gbAttachment",
]

/**
 * `md`: how the Markdown laid a node out — docstream's layout fields (blank lines around it, fences,
 * markers, tag lines as written, image syntax, …) — and, on link and code marks, the link's title /
 * reference label / HTML tag / identity and the code span's backtick count. Opaque to the editor: set from
 * the docstream AST and handed back, so pages round-trip byte-for-byte; docstream ignores whatever no longer
 * fits after an edit. Not carried onto the second half of a split block.
 */
export const GbMarkdownLayout = Extension.create({
  name: "gbMarkdownLayout",
  addGlobalAttributes() {
    return [
      { types: LAYOUT_NODES, attributes: { md: jsonAttribute("data-md", "md") } },
      { types: ["link", "code"], attributes: { md: jsonAttribute("data-md", "md") } },
    ]
  },
})

/**
 * Characters the Markdown wrote backslash-escaped (`snake\_case`): kept escaped on the way out. Not
 * extended by typing next to it.
 */
export const GbEscaped = Mark.create({
  name: "mdEscaped",
  inclusive: false,
  excludes: "",
  parseHTML() {
    return [{ tag: "span[data-md-escaped]" }]
  },
  renderHTML() {
    return ["span", { "data-md-escaped": "" }, 0]
  },
})

export interface ReferenceSources {
  /** "@" — people, agents, … */
  mentions?: ReferenceSource
  /** "#" — channels, tags, … */
  tags?: ReferenceSource
  /** "$" — codebases (`$repo` / `$org/repo`). Enables the "$" trigger. */
  codebases?: ReferenceSource
}

export interface GitbookExtensionOptions {
  placeholder?: string
  /** Built-in "/" slash menu: true (default), false, or a custom item list. */
  slashMenu?: boolean | { items?: SlashItem[] }
  /**
   * The reference chip pickers: true (default: "@" and "#" with free-form entry),
   * false, or per-trigger sources — static lists or async `(query) => options`.
   * "$" (codebases) is only enabled when a `codebases` source is given, so a
   * dollar sign in ordinary prose never opens a menu.
   */
  references?: boolean | ReferenceSources
  /**
   * Disable StarterKit's built-in undo/redo. Required when wiring Yjs
   * Collaboration, which provides its own shared history.
   */
  disableHistory?: boolean
  /** Extra TipTap extensions appended last (e.g. Collaboration, CollaborationCursor). */
  extensions?: AnyExtension[]
}

/**
 * The full GitBook editing extension set, composable by host apps. Use this to
 * build a custom `useEditor(...)` (e.g. with Yjs collaboration) instead of the
 * batteries-included `GitbookEditor` component.
 */
export function createGitbookExtensions(options: GitbookExtensionOptions = {}): AnyExtension[] {
  const {
    placeholder = "Write, or type / to insert a block…",
    slashMenu = true,
    references = true,
    disableHistory = false,
    extensions = [],
  } = options

  const list: AnyExtension[] = [
    StarterKit.configure({
      codeBlock: false,
      code: false,
      // Markdown has no underline: Mod+U would make formatting that's lost on save.
      underline: false,
      ...(disableHistory ? { undoRedo: false } : {}),
    }),
    GbCode,
    GbCodeBlock,
    TaskList,
    GbTaskItem.configure({ nested: true }),
    GbTable.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({ placeholder }),
    GbLinkInner,
    GbMarkSpelling,
    GbMarkdownLayout,
    GbDocumentProperties,
    GbEscaped,
    ...gitbookNodes,
  ]

  if (slashMenu) {
    list.push(slashMenu === true ? SlashMenu : createSlashMenu(slashMenu.items))
  }

  if (references) {
    const opts = references === true ? {} : references
    list.push(
      createReferenceSuggestion({ char: "@", ...(opts.mentions ? { items: opts.mentions } : {}) }),
      createReferenceSuggestion({ char: "#", ...(opts.tags ? { items: opts.tags } : {}) })
    )
    if (opts.codebases) list.push(createReferenceSuggestion({ char: "$", items: opts.codebases }))
  }

  list.push(...extensions)
  return list
}

/**
 * The ProseMirror schema for GitBook documents — identical to what GitbookEditor
 * uses. Hosts wiring Yjs collaboration (y-prosemirror) need this exact schema to
 * convert between a Y.XmlFragment and ProseMirror/markdown safely.
 */
export function getGitbookSchema(): Schema {
  return getSchema(createGitbookExtensions({ slashMenu: false }))
}
