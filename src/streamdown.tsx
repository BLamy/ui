import { useMemo } from "react"
import { DocsRenderer } from "./docs/DocsRenderer"
import { parseMarkdown, trimPartialInlineToken } from "./gitbook/parse"

// Re-exported so markdown-only consumers of ./streamdown can wire chip
// click handling without importing the heavy root entry.
export { CitationSources, DocstreamRefContext, InlineReference } from "./docs/reference"
export type { DocstreamRefContextValue } from "./docs/reference"

export interface GitbookStreamdownProps {
  children?: string
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
      <DocsRenderer doc={gitbookDoc} />
    </div>
  )
}
