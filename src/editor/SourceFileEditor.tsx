import { useCallback, useEffect, useRef, useState } from "react"
import { FileCode2, Save } from "lucide-react"
import { Button } from "@ui-sdk/react/button"
import { Textarea } from "@ui-sdk/react/textarea"
import { SourcePreview, type SourceFileSnapshot, type SourceReferenceClient } from "@brett_lamy/docstream/source"
import type { SourceRefNode } from "@brett_lamy/docstream/gitbook"

export interface SourceFileEditorProps {
  reference: SourceRefNode
  client: SourceReferenceClient
  className?: string
  preview?: boolean
  /** Automatically write edits after a pause. `true` defaults to 500ms. */
  autoSave?: boolean | number
  onSaved?: (snapshot: SourceFileSnapshot) => void
  onError?: (error: Error) => void
}

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause))
}

/** Edit the real file behind a Markdown source reference and preview its export. */
export function SourceFileEditor({ reference, client, className, preview = true, autoSave = false, onSaved, onError }: SourceFileEditorProps) {
  const [content, setContent] = useState("")
  const [savedContent, setSavedContent] = useState("")
  const [revision, setRevision] = useState(0)
  const [status, setStatus] = useState<"loading" | "ready" | "saving" | "error">("loading")
  const [error, setError] = useState<string | null>(null)
  // The file is read when *which* file changes — not when the host re-renders with a new
  // callback or an equal reference object, which would throw away unsaved edits.
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const referenceKey = JSON.stringify([reference.mount, reference.path, reference.exportName ?? null, reference.kind ?? null])
  const referenceRef = useRef(reference)
  referenceRef.current = reference

  useEffect(() => {
    const reference = referenceRef.current
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
        onErrorRef.current?.(next)
      },
    )
    return () => {
      cancelled = true
    }
  }, [client, referenceKey])

  const save = useCallback(async () => {
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
  }, [client, content, onError, onSaved, reference])

  const autoSaveDelay = autoSave === true
    ? 500
    : typeof autoSave === "number" && Number.isFinite(autoSave)
      ? Math.max(0, autoSave)
      : null

  useEffect(() => {
    if (autoSaveDelay === null || status === "loading" || status === "saving" || content === savedContent) return
    const timer = window.setTimeout(() => void save(), autoSaveDelay)
    return () => window.clearTimeout(timer)
  }, [autoSaveDelay, content, save, savedContent, status])

  const wrapper = className ? `gb-source-file-editor ${className}` : "gb-source-file-editor"
  return (
    <section className={wrapper} data-docstream-source-file-editor="">
      <header className="gb-source-file-editor-header">
        <FileCode2 className="size-4" aria-hidden="true" />
        <code>{reference.mount}:{reference.path}#{reference.exportName}</code>
        {autoSaveDelay !== null ? <span className="gb-source-file-editor-status">{status === "saving" ? "Saving…" : content === savedContent ? "Saved" : "Unsaved"}</span> : null}
        {/* The button keeps its name while it saves: it shows `data-pending`, and screen readers hear "Saving". */}
        <Button disabled={status === "loading" || status === "saving" || content === savedContent} focusableWhenDisabled pendingAnnouncement="Saving" onClick={save}>
          <Save className="size-3.5" aria-hidden="true" /> {autoSaveDelay === null ? "Save file" : "Save now"}
        </Button>
      </header>
      {error ? <pre className="gb-source-file-editor-error">{error}</pre> : null}
      <Textarea value={content} onValueChange={setContent} disabled={status === "loading"} spellCheck={false} aria-label={`Edit ${reference.path}`} />
      {preview ? <SourcePreview key={revision} reference={reference} client={client} /> : null}
    </section>
  )
}
