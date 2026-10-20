import { useState } from "react"
import {
  CollapsibleCode,
  CopyButton,
  MathFormula,
  Mermaid,
  SplitCard,
  SplitResult,
  SplitSource,
  TASK_STATES,
  TaskCheckbox,
  type TaskState,
} from "@brett_lamy/docstream"

const SNIPPET = `import { GitbookStreamdown } from "@brett_lamy/docstream"

export function Answer({ text, done }: { text: string; done: boolean }) {
  // Re-parsed on every chunk; unterminated blocks render as they grow.
  return <GitbookStreamdown markdown={text} isStreaming={!done} />
}`

const SQL = "SELECT plan, count(*) FROM signups GROUP BY plan"

// The building blocks docstream's own blocks are made of, used directly.
export default function Primitives({ variant = "code" }: { variant?: string }) {
  const [state, setState] = useState<TaskState>("in-progress")

  if (variant === "tasks") {
    return (
      <div style={{ display: "grid", gap: 14 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <TaskCheckbox state={state} onChange={setState} label="Ship it" />
          Interactive — click, or right-click for the state menu. Now: <code>{state}</code>
        </label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
          {TASK_STATES.map((s) => (
            <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
              <TaskCheckbox state={s.id} label={s.label} />
              <code>[{s.marker}]</code>
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (variant === "split") {
    return (
      <div style={{ display: "grid", gap: 16 }}>
        <SplitCard>
          <SplitSource label="SQL" code={SQL} language="sql" />
          <SplitResult label="Result">
            <table style={{ margin: 12, fontSize: 13 }}>
              <tbody>
                <tr><td>free</td><td>1,204</td></tr>
                <tr><td>pro</td><td>318</td></tr>
              </tbody>
            </table>
          </SplitResult>
        </SplitCard>
        <Mermaid code={"graph LR\n  Source --> SplitSource\n  Result --> SplitResult\n  SplitSource --> SplitCard\n  SplitResult --> SplitCard"} />
        <MathFormula formula={"e^{i\\pi} + 1 = 0"} />
      </div>
    )
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <CollapsibleCode code={SNIPPET} language="tsx" collapsedLines={3} />
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
        <CopyButton text="npm install @brett_lamy/docstream" label="Copy install command" />
        <code>npm install @brett_lamy/docstream</code>
      </span>
    </div>
  )
}
