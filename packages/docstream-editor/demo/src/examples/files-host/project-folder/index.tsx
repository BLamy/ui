import { useCallback, useRef, useState } from "react"
import { GitbookEditor, formatBytes, type FilePicker, type FileUploader } from "@brett_lamy/docstream-editor"
import { Button, LogPane, MarkdownPane, MONO, Pane, Split, useLog } from "./ui"
import { dropFiles, pasteFiles, type EditorInstance } from "./samples"
import { sampleFile, useProject, type ProjectFile } from "./project"

const SEED = `# Bracket v2

The printed part, from the project folder:

{% embed url="./models/bracket.stl" %}

The checkout failure, recorded with rrweb:

{% embed url="./recordings/checkout.rrweb" title="Checkout failure" %}

What the print bed sounds like:

{% embed url="./music/printer.strudel" %}

![Wiring](./images/wiring.svg)
`

type Picking = { kind: "embed" | "image"; resolve: (url: string | null) => void }

/** Every file prop at once: resolveAsset, pickFile, uploadFile, against an in-memory project folder. */
export default function ProjectFolder() {
  const project = useProject()
  const [markdown, setMarkdown] = useState(SEED)
  const [picking, setPicking] = useState<Picking | null>(null)
  const [entries, log] = useLog()
  const editor = useRef<EditorInstance | null>(null)

  // "Choose file…" on embeds, "Choose image…" on figures: the host shows its own chooser.
  const pickFile = useCallback<FilePicker>(
    ({ kind, current }) =>
      new Promise((resolve) => {
        log(`pickFile({ kind: "${kind}", current: "${current}" })`)
        setPicking({
          kind,
          resolve: (url) => {
            log(url ? `  → "${url}"` : "  → null (cancelled)")
            setPicking(null)
            resolve(url)
          },
        })
      }),
    [log],
  )

  // "Upload…", and every dropped or pasted file that isn't an image: store it, return its path.
  const uploadFile = useCallback<FileUploader>(
    async (file, { kind }) => {
      log(`uploadFile(File "${file.name}" ${formatBytes(file.size)}, { kind: "${kind}" }) …`)
      await new Promise((r) => setTimeout(r, 450)) // pretend it's a network round trip
      const path = project.add(file, "uploads")
      log(`  → "${path}"`)
      return path
    },
    [log, project],
  )

  const sample = (how: "drop" | "paste", name: Parameters<typeof sampleFile>[0]) => {
    if (!editor.current) return
    if (how === "drop") dropFiles(editor.current, [sampleFile(name)])
    else pasteFiles(editor.current, [sampleFile(name)])
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Split>
        <Pane
          title="GitbookEditor"
          actions={
            <>
              <Button onClick={() => sample("drop", "sensor-mount.stl")}>Drop sensor-mount.stl</Button>
              <Button onClick={() => sample("paste", "notes.strudel")}>Paste notes.strudel</Button>
            </>
          }
        >
          <GitbookEditor
            markdown={markdown}
            onChange={setMarkdown}
            toolbar={false}
            documentProperties={false}
            resolveAsset={project.resolveAsset}
            pickFile={pickFile}
            uploadFile={uploadFile}
            onEditorReady={(ed) => {
              editor.current = ed
            }}
          />
        </Pane>
        <div style={{ display: "grid", gap: 12 }}>
          <MarkdownPane markdown={markdown} />
          <Pane title={`Project folder (${project.files.length} files)`}>
            <FileList files={project.files} />
          </Pane>
          <LogPane entries={entries} empty="Press Choose file… or Upload… on a block, or drop a file." />
        </div>
      </Split>
      {picking ? <Picker kind={picking.kind} files={project.files} onPick={picking.resolve} /> : null}
    </div>
  )
}

function FileList({ files, onPick }: { files: ProjectFile[]; onPick?: (path: string) => void }) {
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 6, display: "grid", gap: 2, fontSize: 12 }}>
      {files.map((f) => (
        <li key={f.path}>
          <button
            type="button"
            disabled={!onPick}
            onClick={() => onPick?.(f.path)}
            style={{ all: "unset", display: "flex", gap: 10, width: "100%", boxSizing: "border-box", padding: "3px 6px", borderRadius: 5, cursor: onPick ? "pointer" : "default" }}
          >
            <code style={{ fontFamily: MONO }}>{f.path}</code>
            <span style={{ opacity: 0.6 }}>{formatBytes(f.size)}</span>
            {f.origin === "uploaded" ? <span style={{ marginLeft: "auto", color: "var(--primary, #5b5bd6)" }}>uploaded</span> : null}
          </button>
        </li>
      ))}
    </ul>
  )
}

/** The host's file chooser: a list of project files (images only for a figure). */
function Picker({ kind, files, onPick }: { kind: "embed" | "image"; files: ProjectFile[]; onPick: (url: string | null) => void }) {
  const shown = kind === "image" ? files.filter((f) => f.type.startsWith("image/")) : files
  return (
    <div role="dialog" aria-label="Choose a project file" style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgba(10,10,20,.45)" }} onClick={() => onPick(null)}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(420px, 90vw)", background: "var(--background, #fff)", color: "var(--foreground, #16161d)", borderRadius: 12, boxShadow: "0 20px 50px rgba(0,0,0,.3)", overflow: "hidden" }}>
        <div style={{ padding: "10px 14px", fontWeight: 650, fontSize: 13, borderBottom: "1px solid var(--border, #e4e4ea)" }}>
          Choose {kind === "image" ? "an image" : "a file"} from the project
        </div>
        <FileList files={shown} onPick={onPick} />
        <div style={{ padding: 10, display: "flex", justifyContent: "flex-end" }}>
          <Button onClick={() => onPick(null)}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
