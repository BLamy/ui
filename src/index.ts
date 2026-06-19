export { GitbookEditor } from "./editor/Editor"
export type { GitbookEditorProps } from "./editor/Editor"
export { astToTiptap, tiptapToAst } from "./editor/convert"
export type { PMNode } from "./editor/convert"

// Building blocks for composing a custom editor (e.g. with Yjs collaboration
// or a bespoke slash menu) instead of the batteries-included GitbookEditor.
export { createGitbookExtensions, getGitbookSchema, GbTable } from "./editor/extensions"
export type { GitbookExtensionOptions } from "./editor/extensions"
export { gitbookNodes, GbCodeBlock } from "./editor/nodes"
export { SlashMenu, createSlashMenu, SLASH_ITEMS } from "./editor/slash-menu"
export type { SlashItem } from "./editor/slash-menu"
