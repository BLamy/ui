import { useContext, useMemo } from "react"

import { DocsRenderer, type DocRenderOptions, type LivePreviewRenderer, type SourceReferenceRenderer } from "../docs/DocsRenderer"
import { parseMarkdown, trimPartialInlineToken } from "../gitbook/parse"
import { DocstreamDemoRuntimeContext } from "../demo/context"
import { almostNodeDemoRuntime } from "./InlineDemoPreview"
import { ReactCodePreview } from "./ReactCodePreview"

export interface PlaygroundStreamdownProps extends DocRenderOptions {
  children?: string
  sourceRenderer?: SourceReferenceRenderer
  className?: string
  isAnimating?: boolean
  isStreaming?: boolean
  markdown?: string
}

/**
 * The full renderer variant. It keeps the optional almost-node playground
 * behind an explicit import boundary; markdown-only consumers should use the
 * `@brett_lamy/docstream/streamdown` entry instead. Live code fences and
 * `{% demo %}` blocks with inline files (and no resolver) run in almost-node.
 */
export function PlaygroundStreamdown({
  children,
  className,
  isAnimating,
  isStreaming = false,
  markdown,
  sourceRenderer,
  demoResolver,
  demoRuntime,
  demoDependencies,
  pageActions,
}: PlaygroundStreamdownProps) {
  const content = markdown ?? children ?? ""
  // Inline-file demos run in almost-node unless the host (or an outer renderer) chose a runtime.
  const inheritedRuntime = useContext(DocstreamDemoRuntimeContext).runtime
  const runtime = demoRuntime ?? inheritedRuntime ?? almostNodeDemoRuntime
  const doc = useMemo(
    () => parseMarkdown(isStreaming ? trimPartialInlineToken(content) : content),
    [content, isStreaming]
  )
  const liveRenderer: LivePreviewRenderer = ({ files, entry, title, collapsedCodeLines, expandedCodeLines }) => (
    <ReactCodePreview
      files={files}
      entry={entry}
      title={title}
      collapsedCodeLines={collapsedCodeLines}
      expandedCodeLines={expandedCodeLines}
    />
  )

  return (
    <div
      aria-busy={isAnimating ?? isStreaming}
      className={className}
      data-docstream=""
      data-streaming={isStreaming ? "" : undefined}
    >
      <DocsRenderer
        doc={doc}
        markdown={content}
        liveRenderer={liveRenderer}
        sourceRenderer={sourceRenderer}
        demoResolver={demoResolver}
        demoRuntime={runtime}
        demoDependencies={demoDependencies}
        pageActions={isStreaming ? false : pageActions}
      />
    </div>
  )
}
