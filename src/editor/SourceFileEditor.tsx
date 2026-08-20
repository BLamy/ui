import { useEffect, useState } from "react"
import { FileCode2, Save } from "lucide-react"
import { SourcePreview, type SourceFileSnapshot, type SourceReferenceClient } from "@brett_lamy/docstream/source"
import type { SourceRefNode } from "@brett_lamy/docstream/gitbook"

export interface SourceFileEditorProps {
  reference: SourceRefNode
  client: SourceReferenceClient
  className?: string
  preview?: boolean
  onSaved?: (snapshot: SourceFileSnapshot) => void
  onError?: (error: Error) => void
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}

/** Edit the real file behind a Markdown source reference and preview its export. */
export function SourceFileEditor({ reference, client, className, preview = true, onSaved, onError }: SourceFileEditorProps) {
  const [content, setContent] = useState("")
  const [savedContent, setSavedContent] = useState("")
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setStatus("loading")
    setError(null)
    void client.read(reference).then(
      (snapshot) => {
        if (cancelled) return
        setContent(snapshot.content)
        setSavedContent(snapshot.content)
        setStatus("ready")
      },
      (cause: unknown) => {
        if (cancelled) return
        const next = asError(cause)
        setError(next.message)
        setStatus("error")
        onError?.(next)
      },
    )
    return () => {
      cancelled = true
    }
  }, [client, onError, reference])

  const save = async () => {
    setStatus("saving")
    setError(null)
    try {
      const snapshot = await client.write(reference, content)
      setSavedContent(snapshot.content)
      setStatus("ready")
      setRevision((value) => value + 1)
      onSaved?.(snapshot)
    } catch (cause) {
      const next = asError(cause)
      setError(next.message)
      setStatus("error")
      onError?.(next)
    }
  }

  const wrapper = className ? `gb-source-file-editor ${className}` : "gb-source-file-editor"
  return (
    <section className={wrapper} data-docstream-source-file-editor="">
      <header className="gb-source-file-editor-header">
        <FileCode2 className="size-4" />
        <code>{reference.mount}:{reference.path}#{reference.exportName}</code>
        <button type="button" disabled={status === "loading" || status === "saving" || content === savedContent} onClick={() => void save()}>
          <Save className="size-3.5" /> {status === "saving" ? "Saving…" : "Save file"}
        </button>
      </header>
      {error ? <pre className="gb-source-file-editor-error">{error}</pre> : null}
      <textarea value={content} onChange={(event) => setContent(event.target.value)} disabled={status === "loading"} spellCheck={false} aria-label={`Edit ${reference.path}`} />
      {preview ? <SourcePreview key={revision} reference={reference} client={client} /> : null}
    </section>
  )
}
