import { useRef, useState } from "react"
import { GitbookEditor, useDemoVFS, useDemoVFSFiles, type PastedDemoFiles } from "@brett_lamy/docstream-editor"
import { Button, LogPane, MarkdownPane, MONO, Pane, Split, useLog } from "./ui"
import { demoResolver } from "./resolver"
import { demoRuntime } from "./runtime"

type EditorInstance = NonNullable<Parameters<NonNullable<Parameters<typeof GitbookEditor>[0]["onEditorReady"]>>[0]>

const A = `# Source page

{% demo src="widgets/counter" %}

Select the demo block (click its header, or press the button above) and copy it.
`

const B = `# Another document

Paste here.
`

/** Two editors. A knows the demo through its resolver; B has none, so the copy must carry the files. */
export default function CopyPaste({ variant = "inline" }: { variant?: string }) {
  const mode: PastedDemoFiles = variant === "vfs" ? "vfs" : "inline"
  const [a, setA] = useState(A)
  const [b, setB] = useState(B)
  const [share, setShare] = useState(false)
  const vfsA = useDemoVFS()
  const vfsB = useDemoVFS()
  const targetVFS = share ? vfsA : vfsB
  const filesB = useDemoVFSFiles(targetVFS)
  const [entries, log] = useLog()
  const editorA = useRef<EditorInstance | null>(null)

  const selectDemo = () => {
    const ed = editorA.current
    if (!ed) return
    let pos = -1
    ed.state.doc.descendants((node, p) => {
      if (pos < 0 && node.type.name === "gbDemo") pos = p
      return pos < 0
    })
    if (pos >= 0) ed.chain().focus().setNodeSelection(pos).run()
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Split>
        <Pane
          title="Editor A · demoResolver"
          actions={
            <>
              <Button onClick={selectDemo}>Select the demo</Button>
              <Button
                onClick={() => {
                  selectDemo()
                  log(`execCommand("copy") → ${document.execCommand("copy")}`)
                }}
              >
                Copy it
              </Button>
            </>
          }
        >
          <GitbookEditor
            markdown={a}
            onChange={setA}
            toolbar={false}
            documentProperties={false}
            demoResolver={demoResolver}
            demoVFS={vfsA}
            onEditorReady={(ed) => {
              editorA.current = ed
            }}
          />
        </Pane>
        <Pane
          title={<>Editor B · no resolver · pastedDemoFiles="{mode}"</>}
          actions={
            <label style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> share A's demoVFS
            </label>
          }
        >
          <GitbookEditor
            key={`${mode}-${share}`}
            markdown={b}
            onChange={setB}
            toolbar={false}
            documentProperties={false}
            demoRuntime={demoRuntime}
            demoVFS={targetVFS}
            pastedDemoFiles={mode}
            onDemoFilesChange={(files, change) => log(`B onDemoFilesChange(files: { ${Object.keys(files).map((s) => `"${s}"`).join(", ")} }, change: { src: "${change.src}", entry: ${change.entry ? `${change.entry.files.length} file(s)` : "undefined"} })`)}
          />
        </Pane>
      </Split>
      <Split>
        <MarkdownPane markdown={b} title="Editor B's Markdown (live)" />
        <div style={{ display: "grid", gap: 12 }}>
          <Pane title={`B's demo VFS${share ? " (shared with A)" : ""}`}>
            <ul style={{ listStyle: "none", margin: 0, padding: "8px 12px", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.6 }}>
              {Object.keys(filesB).length ? (
                Object.entries(filesB).map(([src, files]) => (
                  <li key={src}>
                    {src}: {files.map((f) => `${f.path} (${f.content.length} chars)`).join(", ")}
                  </li>
                ))
              ) : (
                <li style={{ opacity: 0.6 }}>Empty.</li>
              )}
            </ul>
          </Pane>
          <LogPane entries={entries} empty="Copy the demo from A, paste it into B (or drag its grip across)." />
        </div>
      </Split>
      <details>
        <summary style={{ fontSize: 12, cursor: "pointer" }}>Editor A's Markdown</summary>
        <pre style={{ fontFamily: MONO, fontSize: 11.5, whiteSpace: "pre-wrap" }}>{a}</pre>
      </details>
    </div>
  )
}
