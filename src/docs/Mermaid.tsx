import { useEffect, useId, useState, type CSSProperties } from "react"
import { HighlightedCode } from "./HighlightedCode"

let seq = 0

export interface MermaidProps {
  code: string
  collapsedCodeLines?: number
  expandedCodeLines?: number
}

function positiveLineCount(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback
}

export function Mermaid({ code, collapsedCodeLines = 3, expandedCodeLines = 30 }: MermaidProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [codeExpanded, setCodeExpanded] = useState(false)
  const codePanelId = useId()
  const collapsedLines = positiveLineCount(collapsedCodeLines, 3)
  const expandedLines = Math.max(collapsedLines, positiveLineCount(expandedCodeLines, 30))

  useEffect(() => {
    let cancelled = false
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict" })
        // A fresh id per render: mermaid.render removes any element with the id it is given,
        // so reusing one (StrictMode's double effect, a code change) deleted the diagram an
        // earlier render had already mounted.
        const { svg } = await mermaid.render(`mermaid-${++seq}`, code)
        if (!cancelled) setSvg(svg)
      })
      .catch((e) => {
        if (!cancelled) setError(String(e.message ?? e))
      })
    return () => {
      cancelled = true
    }
  }, [code])

  return (
    <section className="docs-mermaid-preview" data-docstream-mermaid="">
      {error ? (
        <pre className="docs-mermaid-error">mermaid error: {error}</pre>
      ) : svg ? (
        <div className="docs-mermaid" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        <div className="docs-mermaid">Rendering diagram…</div>
      )}
      <div className="docs-react-demo-code docs-mermaid-code">
        <pre
          id={codePanelId}
          className={codeExpanded ? "docs-react-demo-code-body docs-react-demo-code-body-expanded" : "docs-react-demo-code-body"}
          style={{
            "--docs-react-demo-code-lines": codeExpanded ? expandedLines : collapsedLines,
          } as CSSProperties}
        >
          <HighlightedCode code={code} language="mermaid" lineNumbers />
        </pre>
        <button
          type="button"
          className="docs-react-demo-code-toggle"
          aria-controls={codePanelId}
          aria-expanded={codeExpanded}
          onClick={() => setCodeExpanded((value) => !value)}
        >
          {codeExpanded ? "Hide Code" : "View Code"}
        </button>
      </div>
    </section>
  )
}
