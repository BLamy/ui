import StarterKit from "@tiptap/starter-kit"
import Placeholder from "@tiptap/extension-placeholder"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import { getSchema, type AnyExtension } from "@tiptap/core"
import type { Schema } from "@tiptap/pm/model"
import { GbCodeBlock, gitbookNodes } from "./nodes"
import { SlashMenu, createSlashMenu, type SlashItem } from "./slash-menu"

// Carries GitBook's data-view (e.g. "cards") through the editor untouched.
export const GbTable = Table.extend({
  addAttributes() {
    return { ...this.parent?.(), view: { default: null } }
  },
})

export interface GitbookExtensionOptions {
  placeholder?: string
  /** Built-in "/" slash menu: true (default), false, or a custom item list. */
  slashMenu?: boolean | { items?: SlashItem[] }
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
    ...gitbookNodes,
  ]

  if (slashMenu) {
    list.push(slashMenu === true ? SlashMenu : createSlashMenu(slashMenu.items))
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
