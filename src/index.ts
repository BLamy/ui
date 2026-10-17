export { GitbookEditor } from "./editor/Editor"
export { embedBlockFor } from "./editor/Editor"
export type { GitbookEditorProps, EditorAttachment, FilePicker, FilePickKind, AssetResolver } from "./editor/Editor"
export { astToTiptap, tiptapToAst, serializeEditorMarkdown, markdownPasteContent } from "./editor/convert"
export type { PMNode } from "./editor/convert"
export { GbDocumentProperties, DocumentPropertiesEditor } from "./editor/document-properties"
export { GbTaskItem } from "./editor/task-item"
export { TaskCheckbox, TASK_STATE_ICONS } from "@brett_lamy/docstream/tasks"
export { TASK_STATES } from "@brett_lamy/docstream/gitbook"
export type { TaskState } from "@brett_lamy/docstream/gitbook"
export type { DocumentPropertiesNode } from "@brett_lamy/docstream/gitbook"

// Building blocks for composing a custom editor (e.g. with Yjs collaboration
// or a bespoke slash menu) instead of the batteries-included GitbookEditor.
export { createGitbookExtensions, getGitbookSchema, GbCode, GbTable, GbLinkInner, GbMarkSpelling } from "./editor/extensions"
export type { GitbookExtensionOptions, ReferenceSources } from "./editor/extensions"
export { gitbookNodes, GbCodeBlock, GbCommand, GbDemo, GbReference } from "./editor/nodes"
export { GbAttachment, formatBytes } from "./editor/attachments"
export { SlashMenu, createSlashMenu, SLASH_ITEMS } from "./editor/slash-menu"
export type { SlashItem } from "./editor/slash-menu"
export { createReferenceSuggestion, resolveReferenceOptions } from "./editor/reference-menu"
export type {
  ReferenceOption,
  ReferenceSource,
  ReferenceSuggestionOptions,
  ReferenceTrigger,
} from "./editor/reference-menu"
export { SuggestionMenuView, createSuggestionRender } from "./editor/suggestion-menu"
export type { SuggestionMenuItem } from "./editor/suggestion-menu"
export { ReactDemoEditor } from "./editor/ReactDemoEditor"
export type { ReactDemoEditorProps } from "./editor/ReactDemoEditor"
export { SourceFileEditor } from "./editor/SourceFileEditor"
export type { SourceFileEditorProps } from "./editor/SourceFileEditor"

// Demo clipboard + virtual file system (copy a demo with its files, paste it into another editor).
export { clipboardForDoc, lookupDemoSource, payloadContent, registerPayloadFiles, selectionClipboard, useEditorClipboard } from "./editor/demo-clipboard"
export type { ClipboardBridge, DemoSources, PastedDemoFiles } from "./editor/demo-clipboard"
export {
  DOCSTREAM_CLIPBOARD_TYPE,
  createDemoVFS,
  readDocstreamClipboard,
  useDemoVFS,
  useDemoVFSFiles,
} from "@brett_lamy/docstream/demo"
export type { DemoVFS, DemoVFSChange, DemoVFSEntry, DocstreamClipboardPayload } from "@brett_lamy/docstream/demo"
