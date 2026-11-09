import { useId, useState, type CSSProperties } from "react"
import { HighlightedCode } from "./HighlightedCode"
import { CopyButton } from "./copy"

export interface CollapsibleCodeProps {
  code: string
  language: string | null
  /** Lines visible while collapsed. Defaults to 3. */
  collapsedLines?: number
  /** Lines visible when expanded before the panel scrolls. Defaults to 30. */
  expandedLines?: number
  /** Show a copy button in the panel corner. Defaults to true. */
  copy?: boolean
  copyLabel?: string
}

function positiveLineCount(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

/** The line-numbered code panel under a demo: a few lines, then "View Code" to expand. */
export function CollapsibleCode({ code, language, collapsedLines, expandedLines, copy = true, copyLabel }: CollapsibleCodeProps) {
  const [expanded, setExpanded] = useState(false)
  const panelId = useId()
  const collapsed = positiveLineCount(collapsedLines, 3)
  const expandedCount = Math.max(collapsed, positiveLineCount(expandedLines, 30))
  const total = code.split("\n").length
  const needsToggle = total > collapsed
  const isOpen = expanded || !needsToggle
  return (
    <div className="docs-react-demo-code" data-expanded={isOpen || undefined}>
      <pre
        id={panelId}
        className={isOpen ? "docs-react-demo-code-body docs-react-demo-code-body-expanded" : "docs-react-demo-code-body"}
        data-toggle={needsToggle || undefined}
        style={{ "--docs-react-demo-code-lines": isOpen ? expandedCount : collapsed } as CSSProperties}
      >
        <HighlightedCode code={code} language={language} lineNumbers />
      </pre>
      {copy ? <CopyButton text={code} label={copyLabel} className="docs-react-demo-code-copy" /> : null}
      {needsToggle ? (
        <button
          type="button"
          className="docs-react-demo-code-toggle"
          aria-controls={panelId}
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
        >
          {expanded ? "Hide Code" : "View Code"}
        </button>
      ) : null}
    </div>
  )
}
