import { useMemo, useState } from "react"
import { PACKAGE_MANAGERS, packageManagerCommands } from "@brett_lamy/docstream"

const EXAMPLES = [
  "npm install @brett_lamy/docstream react",
  "npm install -D -E vitest",
  "npm install -g serve",
  "npx shadcn@latest add button",
  "npm run build -- --watch",
  "npm create vite@latest my-docs",
  "npm ci && npm test",
]

/** The conversion `{% command %}` runs: type an npm / npx command, read the other three. */
export default function CommandConverter() {
  const [command, setCommand] = useState(EXAMPLES[0])
  const commands = useMemo(() => packageManagerCommands(command), [command])
  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 640, margin: "0 auto", width: "100%" }}>
      <input
        value={command}
        onChange={(event) => setCommand(event.currentTarget.value)}
        aria-label="npm command"
        spellCheck={false}
        style={{
          font: "13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace",
          padding: "8px 12px",
          borderRadius: 8,
          border: "1px solid var(--gb-border, #d4d4d8)",
          background: "transparent",
          color: "inherit",
        }}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {EXAMPLES.map((example) => (
          <button
            key={example}
            type="button"
            onClick={() => setCommand(example)}
            style={{
              font: "11.5px ui-monospace, SFMono-Regular, Menlo, monospace",
              padding: "3px 8px",
              borderRadius: 999,
              cursor: "pointer",
              border: "1px solid var(--gb-border, #d4d4d8)",
              background: example === command ? "var(--gb-accent, #eef)" : "transparent",
              color: "inherit",
            }}
          >
            {example}
          </button>
        ))}
      </div>
      <dl style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 14px", margin: 0 }}>
        {PACKAGE_MANAGERS.map((pm) => (
          <div key={pm} style={{ display: "contents" }}>
            <dt style={{ fontWeight: 600, fontSize: 13 }}>{pm}</dt>
            <dd style={{ margin: 0, font: "13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace", whiteSpace: "pre-wrap" }}>
              {commands[pm]}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
