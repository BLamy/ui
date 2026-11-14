"use client"

import { useEffect, useState } from "react"
import { FileCode2, Play } from "lucide-react"
import { Button } from "@ui-sdk/react/button"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs"
import { Textarea } from "@ui-sdk/react/textarea"

import type { LivePreviewRenderer } from "@brett_lamy/docstream"

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
  /**
   * Renders the running preview, e.g. `almostNodeLiveRenderer` from
   * `@brett_lamy/docstream/playground` (needs `@agent-wasm/core`). The editor never loads a
   * runtime itself: without one the files stay editable and a short note replaces the preview.
   */
  liveRenderer?: LivePreviewRenderer
  /** Refresh the live preview as files are edited (default true). */
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
  liveRenderer,
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
  const paths = Object.keys(draftFiles).sort()
  const pane = (
    <>
      <div className="gb-react-demo-editor-toolbar">
        <code>{selectedFile || "No file selected"}</code>
        {autoPreview ? (
          <span className="gb-react-demo-live-status">Live preview</span>
        ) : (
          <Button
            className="gb-react-demo-preview-button"
            disabled={!selectedFile}
            onClick={() => {
              setPreviewFiles({ ...draftFiles })
              setPreviewRevision((value) => value + 1)
            }}
          >
            <Play className="size-3.5" aria-hidden="true" /> Run demo
          </Button>
        )}
      </div>
      <Textarea
        className="gb-react-demo-textarea"
        value={selectedFile ? draftFiles[selectedFile] ?? "" : ""}
        onValueChange={updateFile}
        spellCheck={false}
        disabled={!selectedFile}
        aria-label={selectedFile ? `Edit ${selectedFile}` : "No file selected"}
      />
    </>
  )

  return (
    <section className={wrapperClass} data-docstream-react-demo-editor="">
      {liveRenderer ? (
        <div key={previewRevision} className="gb-react-demo-editor-preview" style={{ minHeight: typeof height === "number" ? `${height}px` : height }}>
          {liveRenderer({ files: previewFiles, entry, title: "React demo preview" })}
        </div>
      ) : (
        <div className="gb-react-demo-editor-preview docs-demo-runtime-note" role="note">
          Live preview needs the playground runtime (pass <code>liveRenderer</code>). The code is shown below.
        </div>
      )}
      <Tabs
        className="gb-react-demo-editor-source"
        orientation="vertical"
        value={selectedFile || null}
        onValueChange={(path) => {
          if (path !== null) setSelectedFile(path)
        }}
      >
        <div className="gb-react-demo-files">
          <div className="gb-react-demo-files-header">
            <span>Files</span>
            <FileCode2 className="size-4" aria-hidden="true" />
          </div>
          <TabsList className="gb-react-demo-file-list" aria-label="Demo files">
            {paths.map((path) => (
              <TabsTab
                key={path}
                value={path}
                className={(state) => (state.selected ? "gb-react-demo-file gb-react-demo-file-active" : "gb-react-demo-file")}
              >
                {path.replace(/^\//, "")}
              </TabsTab>
            ))}
          </TabsList>
        </div>
        {selectedFile ? (
          <TabsPanel value={selectedFile} className="gb-react-demo-editor-pane">
            {pane}
          </TabsPanel>
        ) : (
          <div className="gb-react-demo-editor-pane">{pane}</div>
        )}
      </Tabs>
    </section>
  )
}
