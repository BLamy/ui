// Pure GitBook markdown engine (no React, no mermaid/streamdown). Safe to import
// in non-DOM environments such as a server-side AI agent or a Cloudflare Worker.
export type * from "./ast"
export { closesFence, demoBody, fenceOpener, fenceTracker, parseDemoVariants, parseMarkdown, parseBlocks, trimPartialInlineToken } from "./parse"
export { fenceFor, serializeBlocks, serializeDemoFile, serializeMarkdown } from "./serialize"
export { footnoteDefinitions, parseInline, plainText, refDefinitions, serializeInline, serializeReference } from "./inline"
