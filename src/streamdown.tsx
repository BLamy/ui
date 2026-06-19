import { useMemo } from "react"
import { DocsRenderer } from "./docs/DocsRenderer"
import { parseMarkdown } from "./gitbook/parse"

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
  const gitbookDoc = useMemo(() => parseMarkdown(content), [content])

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
