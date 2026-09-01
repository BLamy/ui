import { useMemo } from "react"

import { DocsRenderer, type LivePreviewRenderer } from "../docs/DocsRenderer"
import { parseMarkdown, trimPartialInlineToken } from "../gitbook/parse"
import { ReactCodePreview } from "./ReactCodePreview"

export interface PlaygroundStreamdownProps {
  children?: string
  className?: string
  isAnimating?: boolean
  isStreaming?: boolean
  markdown?: string
}

/**
 * The full renderer variant. It keeps the optional almost-node playground
 * behind an explicit import boundary; markdown-only consumers should use the
 * `@brett_lamy/docstream/streamdown` entry instead.
 */
export function PlaygroundStreamdown({
  children,
  className,
  isAnimating,
  isStreaming = false,
  markdown,
}: PlaygroundStreamdownProps) {
  const content = markdown ?? children ?? ""
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
      <DocsRenderer doc={doc} liveRenderer={liveRenderer} />
    </div>
  )
}
