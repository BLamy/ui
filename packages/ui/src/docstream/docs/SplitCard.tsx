import type { ReactNode } from "react"
import { HighlightedCode } from "./HighlightedCode"
import { CopyIcon, useCopied } from "./copy"

/* A source-and-result card: the source on the left (with a copy button), what it makes on the right — side by side
   when the card is wide, stacked when it isn't. Mermaid diagrams (drawn by Pele) and math blocks (typeset by KaTeX)
   use it. */

/** The header's copy button: an icon, named "Copy <label> source" until it has copied. */
export function SplitCopyButton({ label, code }: { label: string; code: string }) {
  const { copied, copy } = useCopied()
  return (
    <button type="button" className="docs-split-action docs-split-copy" aria-label={copied ? "Copied" : `Copy ${label} source`} onClick={() => void copy(code)}>
      <CopyIcon copied={copied} size={16} />
    </button>
  )
}

/** The source pane: its label, a copy button and the highlighted source. */
export function SplitSource({ label, code, language }: { label: string; code: string; language: string }) {
  return (
    <div className="docs-split-pane docs-split-source-pane">
      <div className="docs-split-head">
        <span className="docs-split-label">{label}</span>
        <SplitCopyButton label={label} code={code} />
      </div>
      <pre className="docs-split-source">
        <HighlightedCode code={code} language={language} />
      </pre>
    </div>
  )
}

/** The result pane: a label, an optional action on the right of its header, and the result. */
export function SplitResult({ label, action, className, children }: { label: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <div className={`docs-split-pane docs-split-render-pane${className ? ` ${className}` : ""}`}>
      <div className="docs-split-head">
        <span className="docs-split-label">{label}</span>
        {action}
      </div>
      {children}
    </div>
  )
}

export function SplitCard({ className, children, ...rest }: { className?: string; children: ReactNode; "aria-label"?: string } & Record<`data-${string}`, string>) {
  return (
    <section className={`docs-split-card${className ? ` ${className}` : ""}`} {...rest}>
      <div className="docs-split-grid">{children}</div>
    </section>
  )
}
