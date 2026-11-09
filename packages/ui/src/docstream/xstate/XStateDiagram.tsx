import { useEffect, useState } from "react"
import { PeleDiagram } from "../docs/Mermaid"
import { SplitCard, SplitResult, SplitSource } from "../docs/SplitCard"

export interface XStateDiagramProps { code: string }
export const isXStateLanguage = (language?: string | null) => language?.toLowerCase() === "xstate"

/** The result pane shared by Markdown and the live editor. */
export function XStatePreview({ code }: XStateDiagramProps) {
  const [result, setResult] = useState<{ source: string; diagram?: string; error?: string } | null>(null)
  useEffect(() => {
    let cancelled = false
    import("./machine").then(({ xstateToMermaid }) => {
      if (!cancelled) setResult({ source: code, diagram: xstateToMermaid(code) })
    }).catch((error: unknown) => {
      if (!cancelled) setResult({ source: code, error: error instanceof Error ? error.message : String(error) })
    })
    return () => { cancelled = true }
  }, [code])
  if (result?.source === code && result.diagram) return <PeleDiagram code={result.diagram} />
  return <SplitResult label="XState">{result?.source === code && result.error
    ? <pre className="docs-mermaid-error" role="alert">{result.error}</pre>
    : <div className="docs-mermaid docs-mermaid-pending" role="status">Drawing statechart…</div>}</SplitResult>
}

export function XStateDiagram({ code }: XStateDiagramProps) {
  return <SplitCard className="docs-xstate-preview" data-docstream-xstate="">
    <SplitSource label="XState" code={code} language="typescript" />
    <XStatePreview code={code} />
  </SplitCard>
}
