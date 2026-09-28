// The root entry never references `@agent-wasm/core` (almost-node). Live code fences and
// inline-file demos run only when the host passes a runtime — see `@brett_lamy/docstream/playground`.
export { GitbookStreamdown } from "./streamdown"
export type { GitbookStreamdownProps } from "./streamdown"
export { DocsRenderer, MarkdownContent } from "./docs/DocsRenderer"
export type { DocRenderOptions, LivePreviewProps, LivePreviewRenderer, SourceReferenceRenderer } from "./docs/DocsRenderer"
export { DocPageActions } from "./docs/PageActions"
export type { DocPageAction, DocPageActionsOptions, DocPageActionsProps } from "./docs/PageActions"
export { CollapsibleCode } from "./docs/CollapsibleCode"
export type { CollapsibleCodeProps } from "./docs/CollapsibleCode"
export { CopyButton, copyText } from "./docs/copy"
export { getSyncedTab, setSyncedTab, useSyncedTab } from "./docs/tabs-sync"
export {
  DemoBlock,
  DemoFullscreen,
  DemoViewer,
  DocstreamDemoContext,
  DocstreamDemoRuntimeContext,
  createGlobDemoResolver,
  defaultDemoMarkdown,
  inlineDemoMarkdown,
  inlineDemoNode,
  demoComponentFrom,
  demoFromSearch,
  demoHref,
  preloadDemos,
  resolveDemosToMarkdown,
  sortDemoFiles,
  toInlineFiles,
  useDemoResolver,
  useDemoRuntime,
} from "./demo"
export type {
  DemoComponent,
  DemoComponentProps,
  DemoFile,
  DemoFullscreenProps,
  DemoMarkdownFormat,
  DemoMeta,
  DemoResolver,
  DemoRuntimeOptions,
  DemoVariant,
  DemoViewerProps,
  GlobDemoResolverOptions,
  InlineDemoRuntime,
  InlineDemoRuntimeProps,
  ResolveDemosOptions,
  ResolvedDemo,
} from "./demo"
export { CitationSources, DocstreamRefContext, InlineReference } from "./docs/reference"
export type { CitationPreview, CitationPreviewResolver, DocstreamRefContextValue } from "./docs/reference"
export { ReplayEmbed, ReplayPreview } from "./replay/ReplayPreview"
export type {
  ReplayEventsSource,
  ReplayEventsUrlSource,
  ReplayPageSource,
  ReplayPreviewProps,
  ReplaySource,
} from "./replay/ReplayPreview"
export { isReplayQaUrl, normalizeReplayEmbedUrl } from "./replay/url"
export { VideoEmbed } from "./video"
export type { VideoEmbedProps } from "./video"
export { OpenApiOperation } from "./openapi/OpenApiOperation"
export { createInlineDemoProject, createReactDemoFiles } from "./playground/project"
export type {
  AlmostNodeFile,
  AlmostNodeFileContent,
  AlmostNodeFiles,
  InlineDemoProject,
  InlineDemoProjectOptions,
  ReactDemoFilesOptions,
} from "./playground/project"
export { resolveAsset, setAssetBase } from "./assets"
export { createBundledSourceClient, createViteSourceClient, SourcePreview } from "./source"
export type {
  BundledSourceModule,
  SourceFileSnapshot,
  SourceModule,
  SourcePreviewProps,
  SourceProvenance,
  SourceReferenceClient,
} from "./source"
export { parseDemoVariants, parseMarkdown, parseBlocks, trimPartialInlineToken } from "./gitbook/parse"
export { fenceFor, serializeBlocks, serializeDemoFile, serializeMarkdown } from "./gitbook/serialize"
export {
  defaultInlineDelims,
  footnoteDefinitions,
  inlineDelims,
  parseInline,
  plainText,
  refDefinitions,
  serializeInline,
  serializeReference,
} from "./gitbook/inline"
export type * from "./gitbook/ast"
export { PACKAGE_MANAGERS, packageManagerCommands } from "./gitbook/package-managers"
export { flattenBlocks, flattenForPlainMarkdown } from "./gitbook/flatten"
export { documentOutline, slugify } from "./gitbook/outline"
export type { OutlineEntry } from "./gitbook/outline"
