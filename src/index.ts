// The root entry never references `@agent-wasm/core` (almost-node). Live code fences and
// inline-file demos run only when the host passes a runtime — see `@brett_lamy/docstream/playground`.
export { GitbookStreamdown } from "./streamdown"
export { XStateDiagram, XStatePreview, isXStateLanguage } from "./xstate"
export type { XStateDiagramProps } from "./xstate"
export { TsCircuit, TsCircuitPreview, DEFAULT_TSCIRCUIT_RUNTIME_URL, isTsCircuitLanguage } from "./tscircuit"
export type { TsCircuitProps } from "./tscircuit"
export type { GitbookStreamdownProps } from "./streamdown"
export { DocsRenderer, MarkdownContent, MathFormula, documentEnv } from "./docs/DocsRenderer"
export { TaskCheckbox, TASK_STATE_ICONS } from "./docs/TaskCheckbox"
export type { TaskCheckboxProps, TaskStateChangeHandler } from "./docs/TaskCheckbox"
export { TASK_STATES, getTaskState, taskMarker, taskStateFromMarker } from "./gitbook/tasks"
export { DocstreamEnvProvider, EnvGate, envNamesFromProperties, useDocstreamEnv, useEnvGate, usedEnvNames } from "./doc-env"
export type { DocstreamEnv, DocstreamEnvHost, DocstreamEnvProviderProps, DocstreamEnvValues } from "./doc-env"
export { createEnvKeychain, keychainEnvHost } from "./env-keychain"
export type { EnvKeychain, EnvKeychainOptions, EnvKeychainStatus, KeychainEnvHostOptions } from "./env-keychain"
export { DocumentProperties } from "./docs/DocumentProperties"
export type { DocumentPropertiesProps } from "./docs/DocumentProperties"
export { readDocumentProperties, removeDocumentProperty, setDocumentProperty } from "./gitbook/properties"
export type { DocumentPropertyValue, ParsedDocumentProperties } from "./gitbook/properties"
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
  DocstreamDemoVFSContext,
  DOCSTREAM_CLIPBOARD_TYPE,
  CopyDemoButton,
  createDemoVFS,
  createDocstreamClipboard,
  createDocstreamClipboardFromMarkdown,
  createGlobDemoResolver,
  docstreamClipboardItems,
  parseDocstreamClipboard,
  peekDemoSource,
  prefetchDemoSources,
  readDocstreamClipboard,
  readDocstreamClipboardItems,
  useDemoVFS,
  useDemoVFSFiles,
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
  DemoVFS,
  DemoVFSChange,
  DemoVFSEntry,
  DocstreamClipboard,
  DocstreamClipboardPayload,
  GlobDemoResolverOptions,
  InlineDemoRuntime,
  InlineDemoRuntimeProps,
  ResolveDemosOptions,
  ResolvedDemo,
} from "./demo"
export { CitationSources, DocstreamRefContext, InlineReference } from "./docs/reference"
export type { CitationPreview, CitationPreviewResolver, DocstreamRefContextValue } from "./docs/reference"
export { ReplayEmbed, ReplayPreview, formatReplayTime } from "./replay/ReplayPreview"
export type {
  ReplayEventsSource,
  ReplayEventsUrlSource,
  ReplayPageSource,
  ReplayPreviewHandle,
  ReplayPreviewProps,
  ReplaySource,
} from "./replay/ReplayPreview"
export type { ReplayEvent } from "./replay/types"
export { isReplayQaUrl, normalizeReplayEmbedUrl } from "./replay/url"
export { ReplayFile, isRrwebUrl, splitReplayFragment } from "./replay/ReplayFile"
export { ImageThumbnail, leadingThumbnail, thumbnailLabel } from "./docs/ImageThumbnail"
export type { ReplayFileProps } from "./replay/ReplayFile"
export { VideoEmbed } from "./video"
export type { VideoEmbedProps } from "./video"
export { StlViewer, isStlUrl, parseStl } from "./stl"
export type { StlMesh, StlViewerProps } from "./stl"
export { StrudelPlayer } from "./strudel/StrudelPlayer"
export { Mermaid, PeleDiagram, pelePlaygroundUrl, usePele } from "./docs/Mermaid"
export type { MermaidProps, PeleDrawing } from "./docs/Mermaid"
export { SplitCard, SplitResult, SplitSource } from "./docs/SplitCard"
export { isStrudelFile, isStrudelLanguage } from "./strudel/url"
export type { StrudelPlayerProps } from "./strudel/StrudelPlayer"
export { DEFAULT_TUI_RUNTIME_URL, TuiPreview, TuiEmbed, isTuiCodeBlock } from "./tui"
export type { TuiPreviewProps, TuiPreviewOptions, TuiPreviewState, TuiTheme } from "./tui"
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
export { resolveAsset, setAssetBase, AssetResolverContext, AssetResolverProvider, useAsset, type AssetResolver } from "./assets"
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
