import { useMemo } from "react"
import { DocsRenderer, type DocRenderOptions, type LivePreviewRenderer, type SourceReferenceRenderer } from "./docs/DocsRenderer"
import { parseMarkdown, trimPartialInlineToken } from "./gitbook/parse"

// Re-exported so markdown-only consumers of ./streamdown can wire chip
// click handling without importing the heavy root entry.
export { CitationSources, DocstreamRefContext, InlineReference } from "./docs/reference"
export { DocPageActions } from "./docs/PageActions"
export type { DocPageAction, DocPageActionsOptions, DocPageActionsProps } from "./docs/PageActions"
export type { DocRenderOptions } from "./docs/DocsRenderer"
export { DocstreamDemoContext, DocstreamDemoRuntimeContext, DemoFullscreen, DemoViewer } from "./demo"
export type { DemoFile, DemoMeta, DemoResolver, DemoVariant, InlineDemoRuntime, InlineDemoRuntimeProps } from "./demo"
export type { CitationPreview, CitationPreviewResolver, DocstreamRefContextValue } from "./docs/reference"

export interface GitbookStreamdownProps extends DocRenderOptions {
  children?: string
  liveRenderer?: LivePreviewRenderer
  sourceRenderer?: SourceReferenceRenderer
  className?: string
  isAnimating?: boolean
  isStreaming?: boolean
  markdown?: string
}

export function GitbookStreamdown({
  children,
  className,
  isAnimating,
  isStreaming = false,
  markdown,
  liveRenderer,
  sourceRenderer,
  demoResolver,
  demoRuntime,
  demoDependencies,
  pageActions,
}: GitbookStreamdownProps) {
  const content = markdown ?? children ?? ""
  const gitbookDoc = useMemo(
    () => parseMarkdown(isStreaming ? trimPartialInlineToken(content) : content),
    [content, isStreaming]
  )

  return (
    <div
      aria-busy={isAnimating ?? isStreaming}
      className={className}
      data-docstream=""
      data-streaming={isStreaming ? "" : undefined}
    >
      <DocsRenderer
        doc={gitbookDoc}
        markdown={content}
        liveRenderer={liveRenderer}
        sourceRenderer={sourceRenderer}
        demoResolver={demoResolver}
        demoRuntime={demoRuntime}
        demoDependencies={demoDependencies}
        pageActions={isStreaming ? false : pageActions}
      />
    </div>
  )
}
