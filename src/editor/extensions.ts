import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { Extension, getSchema, type AnyExtension } from "@tiptap/core"
import type { Schema } from "@tiptap/pm/model"
import { GbCodeBlock, gitbookNodes } from "./nodes"
import { SlashMenu, createSlashMenu, type SlashItem } from "./slash-menu"
import { createReferenceSuggestion, type ReferenceSource } from "./reference-menu"

// Carries GitBook's data-view (e.g. "cards") through the editor untouched.
export const GbTable = Table.extend({
  addAttributes() {
    return { ...this.parent?.(), view: { default: null } }
  },
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
      ...(disableHistory ? { undoRedo: false } : {}),
    }),
    GbCodeBlock,
    TaskList,
    TaskItem.configure({ nested: true }),
    GbTable.configure({ resizable: false }),
    TableRow,
    TableHeader,
    TableCell,
    Placeholder.configure({ placeholder }),
    GbLinkInner,
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
