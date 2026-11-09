import { useEffect, useState, type ClipboardEvent } from "react"
import {
  CopyDemoButton,
  DOCSTREAM_CLIPBOARD_TYPE,
  GitbookStreamdown,
  createDocstreamClipboard,
  createDocstreamClipboardFromMarkdown,
  parseMarkdown,
  peekDemoSource,
  prefetchDemoSources,
  readDocstreamClipboard,
  useDemoResolver,
  useDemoVFS,
  useDemoVFSFiles,
  type DocstreamClipboard,
  type DocstreamClipboardPayload,
} from "@brett_lamy/docstream"
import { Panel } from "./Panel"

const SOURCES = ["demos/badges", "demos/signup", "demos/pricing"]

export default function RoundTrip() {
  /* ---- copy side: a src-only demo tag, its files looked up from the host resolver ---- */
  const resolver = useDemoResolver()
  const [src, setSrc] = useState(SOURCES[0])
  const [clip, setClip] = useState<DocstreamClipboard | null>(null)
  const [view, setView] = useState<"text" | "json">("text")

  useEffect(() => {
    if (!resolver) return
    let live = true
    // Fill the viewer cache so `peekDemoSource` can answer synchronously during the copy.
    void prefetchDemoSources(resolver, [src]).then(() => {
      if (!live) return
      const doc = parseMarkdown(`{% demo src="${src}" %}\n`)
      setClip(createDocstreamClipboard(doc, { lookup: (node) => peekDemoSource(resolver, node.src) }))
    })
    return () => {
      live = false
    }
  }, [resolver, src])

  /* ---- paste side: files land in a demo VFS under pasted/<name> ---- */
  const vfs = useDemoVFS()
  const held = useDemoVFSFiles(vfs)
  const [pasted, setPasted] = useState("")

  const register = (payload: DocstreamClipboardPayload) => {
    let markdown = payload.markdown
    for (const [from, files] of Object.entries(payload.files)) {
      // Rename into our own namespace so the host resolver doesn't claim the demo.
      const to = `pasted/${from.split("/").pop()}`
      vfs.set(to, files, payload.meta[from])
      markdown = markdown.split(`src="${from}"`).join(`src="${to}"`)
    }
    setPasted(markdown)
  }
  const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault()
    // The rich payload when it came from docstream; else parse whatever Markdown arrived.
    const payload =
      readDocstreamClipboard(event.clipboardData) ??
      createDocstreamClipboardFromMarkdown(event.clipboardData.getData("text/plain")).payload
    register(payload)
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <Panel
        title="1 · Copy"
        actions={
          <>
            <select value={src} onChange={(e) => setSrc(e.target.value)} aria-label="Demo to copy">
              {SOURCES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select value={view} onChange={(e) => setView(e.target.value as "text" | "json")} aria-label="Representation">
              <option value="text">text/plain</option>
              <option value="json">{DOCSTREAM_CLIPBOARD_TYPE}</option>
            </select>
            <CopyDemoButton clipboard={() => clip} />
          </>
        }
      >
        <pre className="rt-pre">{clip ? (view === "text" ? clip.text : JSON.stringify(clip.payload, null, 2)) : "Fetching files…"}</pre>
      </Panel>

      <Panel
        title="2 · Paste"
        actions={
          <>
            <button type="button" disabled={!clip} onClick={() => clip && register(clip.payload)}>Paste without the clipboard</button>
            <button type="button" disabled={!vfs.list().length} onClick={() => (vfs.clear(), setPasted(""))}>Clear VFS</button>
          </>
        }
      >
        <div
          tabIndex={0}
          onPaste={onPaste}
          className="rt-drop"
          aria-label="Paste target: focus and press Cmd/Ctrl+V"
        >
          {pasted ? (
            <GitbookStreamdown markdown={pasted} demoVFS={vfs} />
          ) : (
            <span>Click here and press ⌘V / Ctrl+V after copying.</span>
          )}
        </div>
        <p className="rt-vfs">
          VFS: {Object.keys(held).length ? Object.entries(held).map(([s, files]) => `${s} (${files.length} files)`).join(", ") : "empty"}
        </p>
      </Panel>
    </div>
  )
}
