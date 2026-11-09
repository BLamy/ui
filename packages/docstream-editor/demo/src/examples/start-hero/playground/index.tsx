import { useState } from "react"
import { GitbookEditor, formatBytes, type EditorAttachment } from "@brett_lamy/docstream-editor"
import type { SourceFileSnapshot } from "@brett_lamy/docstream/source"
import { SEED } from "./seed"
import { virtualSource } from "./virtual-source"
import "./playground.css"

/* The editor on the left, the Markdown it serializes on the right — updated on every keystroke.
   Toggle the props to see what each one changes; paste or drop an image to try the two modes. */
export default function Playground() {
  const [markdown, setMarkdown] = useState(SEED)
  const [toolbar, setToolbar] = useState(true)
  const [editable, setEditable] = useState(true)
  const [properties, setProperties] = useState(true)
  const [imagePaste, setImagePaste] = useState<"inline" | "chip">("inline")
  const [attachments, setAttachments] = useState<EditorAttachment[]>([])
  const [saved, setSaved] = useState<SourceFileSnapshot | null>(null)

  return (
    <div className="pg">
      <div className="pg-bar">
        <label><input type="checkbox" checked={toolbar} onChange={(e) => setToolbar(e.target.checked)} /> toolbar</label>
        <label><input type="checkbox" checked={editable} onChange={(e) => setEditable(e.target.checked)} /> editable</label>
        <label><input type="checkbox" checked={properties} onChange={(e) => setProperties(e.target.checked)} /> documentProperties</label>
        <label>
          imagePaste
          <select value={imagePaste} onChange={(e) => setImagePaste(e.target.value as "inline" | "chip")}>
            <option value="inline">inline</option>
            <option value="chip">chip</option>
          </select>
        </label>
        <button type="button" onClick={() => setMarkdown(SEED)} disabled={markdown === SEED}>Reset</button>
      </div>

      <div className="pg-panes">
        <section className="pg-pane">
          <header>GitbookEditor</header>
          <GitbookEditor
            // `editable` is read when the editor is created: remount to switch it.
            key={editable ? "editable" : "read-only"}
            className="pg-editor"
            markdown={markdown}
            onChange={setMarkdown}
            toolbar={toolbar}
            editable={editable}
            documentProperties={properties}
            placeholder="Write something, or type / …"
            references={{
              mentions: [{ id: "brett", label: "Brett", group: "People" }, { id: "dana", label: "Dana", group: "People" }],
              tags: ["seasonal", "releases", "ops"],
            }}
            imagePaste={imagePaste}
            attachments={attachments}
            onAttachmentAdd={({ file: _file, ...attachment }) => setAttachments((all) => [...all, attachment])}
            onAttachmentRemove={(ids) => setAttachments((all) => all.filter((a) => !ids.includes(a.id)))}
            sourceClient={virtualSource}
            onSourceSaved={setSaved}
          />
          <footer>
            {saved ? `Saved ${saved.provenance.path} · ${saved.content.length} bytes` : "Edit the Button source: it autosaves to an in-memory file"}
            {attachments.length ? ` · ${attachments.length} attachment${attachments.length === 1 ? "" : "s"} (${attachments.map((a) => formatBytes(a.size)).join(", ")})` : ""}
          </footer>
        </section>

        <section className="pg-pane pg-source">
          <header>
            Serialized Markdown
            <span>{markdown === SEED ? "identical to the seed" : `${markdown.length} chars`}</span>
          </header>
          <pre>{markdown}</pre>
        </section>
      </div>
    </div>
  )
}
