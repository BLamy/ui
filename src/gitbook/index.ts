// Pure GitBook markdown engine (no React, no mermaid/streamdown). Safe to import
// in non-DOM environments such as a server-side AI agent or a Cloudflare Worker.
export type * from "./ast"
export { TASK_STATES, getTaskState, taskMarker, taskStateFromMarker } from "./tasks"
export { readDocumentProperties, removeDocumentProperty, setDocumentProperty } from "./properties"
export type { DocumentPropertyValue, ParsedDocumentProperties } from "./properties"
export { escapeAttr, unescapeAttr } from "./attrs"
export { closesFence, demoBody, fenceOpener, fenceTracker, parseDemoVariants, parseMarkdown, parseBlocks, trimPartialInlineToken } from "./parse"
export { fenceFor, serializeBlocks, serializeDemoFile, serializeMarkdown } from "./serialize"
export { defaultInlineDelims, footnoteDefinitions, inlineDelims, parseInline, plainText, refDefinitions, serializeInline, serializeReference } from "./inline"
export { PACKAGE_MANAGERS, packageManagerCommands } from "./package-managers"
export { flattenBlocks, flattenForPlainMarkdown } from "./flatten"
export { documentOutline, slugify } from "./outline"
export type { OutlineEntry } from "./outline"
