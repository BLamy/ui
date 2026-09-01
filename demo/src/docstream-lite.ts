/* Slim re-export of the docstream surface the demo uses — avoids pulling the
   playground entry, whose @agent-wasm/core peer isn't needed for docs rendering. */
export { GitbookStreamdown } from '../../src/streamdown';
export { DocsRenderer, MarkdownContent } from '../../src/docs/DocsRenderer';
export type { LivePreviewProps, LivePreviewRenderer } from '../../src/docs/DocsRenderer';
export type { SourceReferenceRenderer } from '../../src/docs/DocsRenderer';
export { SourcePreview, createViteSourceClient } from '../../src/source';
export { VideoEmbed } from '../../src/video';
export { parseMarkdown, trimPartialInlineToken } from '../../src/gitbook/parse';
export { CitationSources, DocstreamRefContext, InlineReference } from '../../src/docs/reference';
export type { CitationPreview, CitationPreviewResolver, DocstreamRefContextValue } from '../../src/docs/reference';
