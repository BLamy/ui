import { useCallback, useMemo, useState } from "react"
import { GitbookEditor } from "@brett_lamy/docstream-editor"
import type { SourceFileSnapshot } from "@brett_lamy/docstream/source"
import { LogPane, MarkdownPane, MONO, Pane, Split, useLog } from "./ui"
import { createMemorySourceClient } from "./memory-client"
import { FILES } from "./files"

const SEED = `# Component notes

The badge on the pricing page. Edit its file below: the preview re-renders after each save.

{% source-ref mount="app" path="src/Badge.js" export="default" kind="component" title="Badge" %}

The button's stories (CSF: the default export's \`args\` merge with the story's):

{% source-ref mount="app" path="src/Button.stories.js" export="Danger" kind="story" title="Danger button" %}

A reference to a file that isn't there:

{% source-ref mount="app" path="src/Missing.js" export="default" kind="component" title="Missing" %}
`

const SAVE_OPTIONS = { "true": true, "false": false, "2000": 2000 } as const

/** `{% source-ref %}` blocks editing real (here: in-memory) files through a `sourceClient`. */
export default function VirtualClient() {
  const [markdown, setMarkdown] = useState(SEED)
  const [preview, setPreview] = useState(true)
  const [autoSave, setAutoSave] = useState<keyof typeof SAVE_OPTIONS>("true")
  const [disk, setDisk] = useState(0)
  const [entries, log] = useLog()
  const client = useMemo(() => createMemorySourceClient(FILES, () => setDisk((n) => n + 1)), [])

  // Keep both callbacks stable: the source editor re-reads its file when they change.
  const onSourceSaved = useCallback(
    (s: SourceFileSnapshot) => log(`onSourceSaved({ provenance: { path: "${s.provenance.path}", exportName: "${s.provenance.exportName}" }, content: ${s.content.length} chars })`),
    [log],
  )
  const onSourceError = useCallback((error: Error) => log(`onSourceError(${error.message})`), [log])

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Split>
        <Pane
          title="GitbookEditor · sourceClient"
          actions={
            <>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input type="checkbox" checked={preview} onChange={(e) => setPreview(e.target.checked)} /> sourcePreview
              </label>
              <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
                sourceAutoSave
                <select value={autoSave} onChange={(e) => setAutoSave(e.target.value as keyof typeof SAVE_OPTIONS)} style={{ font: "inherit" }}>
                  {Object.keys(SAVE_OPTIONS).map((k) => (
                    <option key={k} value={k}>
                      {k === "2000" ? "{2000}" : `{${k}}`}
                    </option>
                  ))}
                </select>
              </label>
            </>
          }
        >
          <GitbookEditor
            markdown={markdown}
            onChange={setMarkdown}
            toolbar={false}
            documentProperties={false}
            sourceClient={client}
            sourcePreview={preview}
            sourceAutoSave={SAVE_OPTIONS[autoSave]}
            onSourceSaved={onSourceSaved}
            onSourceError={onSourceError}
          />
        </Pane>
        <div style={{ display: "grid", gap: 12 }}>
          <LogPane entries={entries} empty="Edit a file below a source ref." />
          <Pane title={`The files (${disk} write${disk === 1 ? "" : "s"})`}>
            <div style={{ maxHeight: 300, overflow: "auto" }}>
              {[...client.files].map(([path, code]) => (
                <details key={path} style={{ borderBottom: "1px solid var(--border, #e4e4ea)" }} open={path === "src/Badge.js"}>
                  <summary style={{ padding: "6px 12px", fontFamily: MONO, fontSize: 12, cursor: "pointer" }}>app:{path}</summary>
                  <pre style={{ margin: 0, padding: "0 12px 10px", fontFamily: MONO, fontSize: 11.5, whiteSpace: "pre-wrap" }}>{code}</pre>
                </details>
              ))}
            </div>
          </Pane>
          <MarkdownPane markdown={markdown} title="Markdown (unchanged by file edits)" />
        </div>
      </Split>
    </div>
  )
}
