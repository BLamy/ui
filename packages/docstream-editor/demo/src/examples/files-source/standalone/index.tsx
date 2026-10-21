import { useCallback, useMemo, useState } from "react"
import { SourceFileEditor } from "@brett_lamy/docstream-editor"
import type { SourceRefNode } from "@brett_lamy/docstream/gitbook"
import type { SourceFileSnapshot } from "@brett_lamy/docstream/source"
import { LogPane, Pane, useLog } from "./ui"
import { createMemorySourceClient } from "./memory-client"
import { FILES } from "./files"

const REFERENCES: Record<string, SourceRefNode> = {
  "Button.js#Button": { type: "source-ref", mount: "app", path: "src/Button.js", exportName: "Button", kind: "component" },
  "Button.stories.js#Primary": { type: "source-ref", mount: "app", path: "src/Button.stories.js", exportName: "Primary", kind: "story" },
  "Button.stories.js#Danger": { type: "source-ref", mount: "app", path: "src/Button.stories.js", exportName: "Danger", kind: "story" },
}

/** `SourceFileEditor` on its own: the same file editor a source-ref block shows, outside any document. */
export default function Standalone({ variant = "manual" }: { variant?: string }) {
  const client = useMemo(() => createMemorySourceClient(FILES), [])
  const [which, setWhich] = useState("Button.stories.js#Danger")
  const [entries, log] = useLog()
  const onSaved = useCallback((s: SourceFileSnapshot) => log(`onSaved: ${s.provenance.path} (${s.content.length} chars)`), [log])
  const onError = useCallback((e: Error) => log(`onError: ${e.message}`), [log])
  const reference = REFERENCES[which]!

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 720, margin: "0 auto" }}>
      <Pane
        title={<>SourceFileEditor · autoSave={variant === "auto" ? "{true}" : "{false}"}</>}
        actions={
          <select value={which} onChange={(e) => setWhich(e.target.value)} style={{ font: "inherit" }}>
            {Object.keys(REFERENCES).map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        }
      >
        <div style={{ padding: 10 }}>
          <SourceFileEditor key={variant} reference={reference} client={client} autoSave={variant === "auto"} onSaved={onSaved} onError={onError} />
        </div>
      </Pane>
      <LogPane entries={entries} empty="Edit, then press Save file (or wait, with autoSave)." />
    </div>
  )
}
