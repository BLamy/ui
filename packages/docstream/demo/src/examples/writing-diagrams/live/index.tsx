import { useState } from "react"
import { Mermaid } from "@brett_lamy/docstream"

const START = `flowchart LR
  A[Edit me] --> B{Pele}
  B -->|sync SVG| C[This card]
  B -->|no layout pass| D[Fast]`

/** A mermaid fence is just this component: edit the source, Pele redraws as you type. */
export default function LiveDiagram() {
  const [code, setCode] = useState(START)
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <textarea
        value={code}
        onChange={(event) => setCode(event.currentTarget.value)}
        aria-label="Mermaid source"
        spellCheck={false}
        rows={6}
        style={{
          font: "12.5px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace",
          padding: 12,
          borderRadius: 10,
          border: "1px solid var(--gb-border, #d4d4d8)",
          background: "transparent",
          color: "inherit",
          resize: "vertical",
        }}
      />
      <Mermaid code={code} />
    </div>
  )
}
