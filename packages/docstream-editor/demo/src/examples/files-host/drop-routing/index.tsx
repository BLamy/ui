import { useCallback, useRef, useState } from "react"
import { GitbookEditor, formatBytes, type FileUploader } from "@brett_lamy/docstream-editor"
import { Button, LogPane, MarkdownPane, Pane, Split, useLog } from "./ui"
import { dropFiles, pasteFiles, sampleImage, type EditorInstance } from "./samples"
import { sampleFile, useProject } from "./project"

const SEED = `# Field notes

Drop files below.
`

/**
 * Who handles a dropped file. `onDropEmbeds` sees every drop first and may claim it (return URLs) or
 * pass (return null). Unclaimed image files go inline; anything else goes to `uploadFile`.
 */
export default function DropRouting({ variant = "both" }: { variant?: string }) {
  const project = useProject()
  const [markdown, setMarkdown] = useState(SEED)
  const [entries, log] = useLog()
  const editor = useRef<EditorInstance | null>(null)
  const shots = useRef(0)

  const claim = variant === "claim" || variant === "both"
  const upload = variant === "upload" || variant === "both"

  const onDropEmbeds = useCallback(
    (data: DataTransfer) => {
      const files = [...data.files]
      // "both": claim only .stl files (copy them into ./models); everything else passes.
      const mine = variant === "both" ? files.filter((f) => /\.stl$/i.test(f.name)) : files
      if (!mine.length) {
        log(`onDropEmbeds([${files.map((f) => f.name).join(", ")}]) → null (not mine)`)
        return null
      }
      const paths = mine.map((f) => project.add(f, f.type.startsWith("image/") ? "images" : "models"))
      log(`onDropEmbeds([${files.map((f) => f.name).join(", ")}]) → ${JSON.stringify(paths)}`)
      return paths
    },
    [log, project, variant],
  )

  const uploadFile = useCallback<FileUploader>(
    async (file, { kind }) => {
      await new Promise((r) => setTimeout(r, 300))
      const path = project.add(file, "uploads")
      log(`uploadFile("${file.name}" ${formatBytes(file.size)}, { kind: "${kind}" }) → "${path}"`)
      return path
    },
    [log, project],
  )

  const drop = async (what: "stl" | "rrweb" | "png") => {
    const ed = editor.current
    if (!ed) return
    const file = what === "png" ? await sampleImage(++shots.current) : sampleFile(what === "stl" ? "sensor-mount.stl" : "session.rrweb")
    log(`— drop ${file.name}`)
    dropFiles(ed, [file])
  }

  return (
    <Split>
      <Pane
        title={<>{[claim && "onDropEmbeds", upload && "uploadFile"].filter(Boolean).join(" + ")}</>}
        actions={
          <>
            <Button onClick={() => void drop("stl")}>Drop .stl</Button>
            <Button onClick={() => void drop("rrweb")}>Drop .rrweb</Button>
            <Button onClick={() => void drop("png")}>Drop .png</Button>
            <Button
              onClick={() => {
                if (!editor.current) return
                log("— paste session.rrweb")
                pasteFiles(editor.current, [sampleFile("session.rrweb")])
              }}
            >
              Paste .rrweb
            </Button>
          </>
        }
      >
        <GitbookEditor
          key={variant}
          markdown={markdown}
          onChange={setMarkdown}
          toolbar={false}
          documentProperties={false}
          resolveAsset={project.resolveAsset}
          {...(claim ? { onDropEmbeds } : {})}
          {...(upload ? { uploadFile } : {})}
          onEditorReady={(ed) => {
            editor.current = ed
          }}
        />
      </Pane>
      <div style={{ display: "grid", gap: 12 }}>
        <LogPane entries={entries} title="Who took it" empty="Drop a file (or use the buttons)." />
        <MarkdownPane markdown={markdown} />
      </div>
    </Split>
  )
}
