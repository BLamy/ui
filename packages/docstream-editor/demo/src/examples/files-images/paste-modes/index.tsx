import { useRef, useState } from "react"
import { GitbookEditor, formatBytes, type EditorAttachment } from "@brett_lamy/docstream-editor"
import { Button, LogPane, MarkdownPane, MONO, Pane, Split, useLog } from "./ui"
import { dropFiles, pasteFiles, sampleImage, type EditorInstance } from "./samples"

const SEED = `# Bug report

The checkout button overlaps the total on small screens. Paste a screenshot below this line.

`

/** `imagePaste="inline"` vs `"chip"`: paste or drop an image and watch the Markdown and the host's store. */
export default function PasteModes({ variant = "inline" }: { variant?: string }) {
  const mode = variant === "chip" ? "chip" : "inline"
  const [markdown, setMarkdown] = useState(SEED)
  const [attachments, setAttachments] = useState<EditorAttachment[]>([])
  const [customOpen, setCustomOpen] = useState(false)
  const [lightbox, setLightbox] = useState<EditorAttachment | null>(null)
  const [entries, log] = useLog()
  const editor = useRef<EditorInstance | null>(null)
  const count = useRef(0)

  const sample = async (how: "paste" | "drop") => {
    const ed = editor.current
    if (!ed) return
    const file = await sampleImage(++count.current)
    if (how === "paste") pasteFiles(ed, [file])
    else dropFiles(ed, [file])
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Split>
        <Pane
          title={<>GitbookEditor · imagePaste="{mode}"</>}
          actions={
            <>
              <Button onClick={() => void sample("paste")}>Paste a sample image</Button>
              <Button onClick={() => void sample("drop")}>Drop one</Button>
            </>
          }
        >
          <GitbookEditor
            key={mode}
            markdown={markdown}
            onChange={setMarkdown}
            toolbar={false}
            documentProperties={false}
            imagePaste={mode}
            attachments={attachments}
            onAttachmentAdd={({ file, ...attachment }) => {
              log(`onAttachmentAdd({ id: "${attachment.id}", name: "${attachment.name}", size: ${attachment.size}, type: "${attachment.type}", file: File })`)
              setAttachments((all) => [...all, attachment])
            }}
            onAttachmentRemove={(ids) => {
              log(`onAttachmentRemove(${JSON.stringify(ids)})`)
              setAttachments((all) => all.filter((a) => !ids.includes(a.id)))
            }}
            {...(customOpen
              ? {
                  onAttachmentOpen: (attachment: EditorAttachment) => {
                    log(`onAttachmentOpen("${attachment.id}")`)
                    setLightbox(attachment)
                  },
                }
              : {})}
            onEditorReady={(ed) => {
              editor.current = ed
            }}
            placeholder="Paste or drop an image…"
          />
        </Pane>
        <MarkdownPane markdown={markdown} />
      </Split>
      {mode === "chip" ? (
        <Split>
          <Pane
            title={`Host attachment store (${attachments.length})`}
            actions={
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={customOpen} onChange={(e) => setCustomOpen(e.target.checked)} />
                custom onAttachmentOpen
              </label>
            }
          >
            <ul style={{ listStyle: "none", margin: 0, padding: 8, display: "grid", gap: 6 }}>
              {attachments.length ? (
                attachments.map((a) => (
                  <li key={a.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                    {a.src ? <img src={a.src} alt="" style={{ width: 40, height: 26, objectFit: "cover", borderRadius: 4 }} /> : null}
                    <code style={{ fontFamily: MONO }}>{a.id}</code>
                    <span>{a.name}</span>
                    <span style={{ opacity: 0.6 }}>{formatBytes(a.size)}</span>
                    <span style={{ marginLeft: "auto" }}>
                      <Button onClick={() => editor.current?.commands.removeAttachment(a.id)}>removeAttachment</Button>
                    </span>
                  </li>
                ))
              ) : (
                <li style={{ fontSize: 12, opacity: 0.6, padding: 4 }}>Empty. Paste an image: the chip goes in the document, the file comes here.</li>
              )}
            </ul>
          </Pane>
          <LogPane entries={entries} />
        </Split>
      ) : (
        <LogPane entries={entries} title="Host callbacks (none fire in inline mode: the file is in the document)" />
      )}
      {lightbox ? (
        <div
          role="dialog"
          aria-label={lightbox.name}
          onClick={() => setLightbox(null)}
          style={{ position: "fixed", inset: 0, zIndex: 50, display: "grid", placeItems: "center", background: "rgba(10,10,20,.72)", cursor: "zoom-out" }}
        >
          <figure style={{ margin: 0, color: "#fff", textAlign: "center", fontSize: 13 }}>
            <img src={lightbox.src} alt={lightbox.name} style={{ maxWidth: "80vw", maxHeight: "70vh", borderRadius: 8 }} />
            <figcaption>The host's own viewer: {lightbox.name}</figcaption>
          </figure>
        </div>
      ) : null}
    </div>
  )
}
