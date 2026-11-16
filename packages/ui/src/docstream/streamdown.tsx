import { useMemo } from "react"
import { DocsRenderer, type DocRenderOptions, type LivePreviewRenderer, type SourceReferenceRenderer } from "./docs/DocsRenderer"
import { parseMarkdown, trimPartialInlineToken } from "./gitbook/parse"

// Re-exported so markdown-only consumers of ./streamdown can wire chip
// click handling without importing the heavy root entry.
export { CitationSources, DocstreamRefContext, InlineReference } from "./docs/reference"
export { DocPageActions } from "./docs/PageActions"
export type { DocPageAction, DocPageActionsOptions, DocPageActionsProps } from "./docs/PageActions"
export type { DocRenderOptions } from "./docs/DocsRenderer"
export type { CodeBlockRenderDetails, CodeBlockRenderer } from "./docs/code-render"
export { DocstreamDemoContext, DocstreamDemoRuntimeContext, DemoFullscreen, DemoViewer } from "./demo"
export type { DemoFile, DemoMeta, DemoResolver, DemoVariant, InlineDemoRuntime, InlineDemoRuntimeProps } from "./demo"
export type { CitationPreview, CitationPreviewResolver, DocstreamRefContextValue } from "./docs/reference"

export interface GitbookStreamdownProps extends DocRenderOptions {
  children?: string
  liveRenderer?: LivePreviewRenderer
  sourceRenderer?: SourceReferenceRenderer
  className?: string
  animating?: boolean
  streaming?: boolean
  markdown?: string
}

export function GitbookStreamdown({
  children,
  className,
  animating,
  streaming = false,
  markdown,
  liveRenderer,
  sourceRenderer,
  demoResolver,
  demoRuntime,
  demoDependencies,
  demoVFS,
  pageActions,
  documentProperties,
  onTaskStateChange,
  envHost,
  env,
  tui,
  renderCode,
}: GitbookStreamdownProps) {
  const content = markdown ?? children ?? ""
  const gitbookDoc = useMemo(
    () => parseMarkdown(streaming ? trimPartialInlineToken(content) : content),
    [content, streaming]
  )

  return (
    <div
      aria-busy={animating ?? streaming}
      className={className}
      data-docstream=""
      data-streaming={streaming ? "" : undefined}
    >
      <DocsRenderer
        doc={gitbookDoc}
        markdown={content}
        liveRenderer={liveRenderer}
        sourceRenderer={sourceRenderer}
        demoResolver={demoResolver}
        demoRuntime={demoRuntime}
        demoDependencies={demoDependencies}
        demoVFS={demoVFS}
        pageActions={streaming ? false : pageActions}
        documentProperties={documentProperties}
        onTaskStateChange={onTaskStateChange}
        envHost={envHost}
        env={env}
        tui={tui}
        renderCode={renderCode}
        streaming={streaming}
      />
    </div>
  )
}
