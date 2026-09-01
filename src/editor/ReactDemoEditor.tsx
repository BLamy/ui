import { useEffect, useState } from "react"
import { FileCode2, Play } from "lucide-react"

import { ReactCodePreview } from "@brett_lamy/docstream/playground"

export interface ReactDemoEditorProps {
  /** Source files keyed by their project-relative or absolute paths. */
  files: Readonly<Record<string, string>>
  /** Vite entry file. Defaults to `/src/main.jsx`. */
  entry?: string
  /** Preview height after the user runs the demo. */
  height?: number | string
  className?: string
  /** Called whenever a file is edited. */
  onChange?: (files: Record<string, string>) => void
  /** Refresh the AlmostNode preview as files are edited (default true). */
  autoPreview?: boolean
  /** Delay before a live preview receives edited files (default 350ms). */
  previewDebounceMs?: number
}

function nextFile(files: Readonly<Record<string, string>>): string {
  return Object.keys(files).sort()[0] ?? ""
}

/** A small multi-file source editor paired with the Docstream React preview. */
export function ReactDemoEditor({
  files,
  entry = "/src/main.jsx",
  height = 320,
  className,
  onChange,
  autoPreview = true,
  previewDebounceMs = 350,
}: ReactDemoEditorProps) {
  const [draftFiles, setDraftFiles] = useState<Record<string, string>>(() => ({ ...files }))
  const [selectedFile, setSelectedFile] = useState(() => nextFile(files))
  const [previewFiles, setPreviewFiles] = useState<Record<string, string>>(() => ({ ...files }))
  const [previewRevision, setPreviewRevision] = useState(0)

  useEffect(() => {
    setDraftFiles({ ...files })
    setPreviewFiles({ ...files })
    setSelectedFile((current) => (current && files[current] !== undefined ? current : nextFile(files)))
  }, [files])

  useEffect(() => {
    if (!autoPreview) return
    const timer = window.setTimeout(
      () => setPreviewFiles({ ...draftFiles }),
      Math.max(0, previewDebounceMs),
    )
    return () => window.clearTimeout(timer)
  }, [autoPreview, draftFiles, previewDebounceMs])

  const updateFile = (content: string) => {
    if (!selectedFile) return
    const next = { ...draftFiles, [selectedFile]: content }
    setDraftFiles(next)
    onChange?.(next)
  }

  const wrapperClass = className ? `gb-react-demo-editor ${className}` : "gb-react-demo-editor"

  return (
    <section className={wrapperClass} data-docstream-react-demo-editor="">
      <ReactCodePreview
        key={previewRevision}
        files={previewFiles}
        entry={entry}
        height={height}
        title="React demo preview"
      />
      <div className="gb-react-demo-editor-source">
        <aside className="gb-react-demo-files" aria-label="Demo files">
          <div className="gb-react-demo-files-header">
            <span>Files</span>
            <FileCode2 className="size-4" />
          </div>
          {Object.keys(draftFiles)
            .sort()
            .map((path) => (
              <button
                type="button"
                key={path}
                className={path === selectedFile ? "gb-react-demo-file gb-react-demo-file-active" : "gb-react-demo-file"}
                onClick={() => setSelectedFile(path)}
              >
                {path.replace(/^\//, "")}
              </button>
            ))}
        </aside>
        <div className="gb-react-demo-editor-pane">
          <div className="gb-react-demo-editor-toolbar">
            <code>{selectedFile || "No file selected"}</code>
            {autoPreview ? (
              <span className="gb-react-demo-live-status">Live preview</span>
            ) : (
              <button
                type="button"
                className="gb-react-demo-preview-button"
                disabled={!selectedFile}
                onClick={() => {
                  setPreviewFiles({ ...draftFiles })
                  setPreviewRevision((value) => value + 1)
                }}
              >
                <Play className="size-3.5" /> Run demo
              </button>
            )}
          </div>
          <textarea
            className="gb-react-demo-textarea"
            value={selectedFile ? draftFiles[selectedFile] ?? "" : ""}
            onChange={(event) => updateFile(event.target.value)}
            spellCheck={false}
            disabled={!selectedFile}
            aria-label={selectedFile ? `Edit ${selectedFile}` : "No file selected"}
          />
        </div>
      </div>
    </section>
  )
}
