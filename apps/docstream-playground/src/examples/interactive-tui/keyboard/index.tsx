import { useState } from "react"
import { GitbookStreamdown } from "@brett_lamy/ui/docstream/streamdown"
import { code } from "./source"

const markdown = `\`\`\`typescript tui title="Terminal in an AI response"\n${code}\n\`\`\``

export default function TerminalResponse() {
  const [isStreaming, setStreaming] = useState(false)
  // An optional build-time override makes the same example testable against a local runtime.
  const runtimeUrl = import.meta.env.VITE_OPENTUI_RUNTIME_URL || undefined
  return (
    <div style={{ padding: 16, minWidth: 0 }}>
      <label style={{ display: "flex", gap: 8, marginBottom: 12, fontSize: 13 }}>
        <input type="checkbox" checked={isStreaming} onChange={(event) => setStreaming(event.target.checked)} />
        Response is still streaming (Run stays disabled)
      </label>
      <GitbookStreamdown markdown={markdown} isStreaming={isStreaming} tui={{ runtimeUrl, height: 280 }} />
    </div>
  )
}
