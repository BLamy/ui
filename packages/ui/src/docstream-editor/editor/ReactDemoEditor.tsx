"use client"

import { useEffect, useState } from "react"
import { Glyph } from "./glyph"
import { Button } from "@ui-sdk/react/button"
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs"
import { Textarea } from "@ui-sdk/react/textarea"
import type { ChangeDetails } from "@ui-sdk/core"
import { changeDetails } from "@brett_lamy/ui/lib/change-details"

import type { LivePreviewRenderer } from "@brett_lamy/ui/docstream"

/** Why the files changed: a file's source was edited. `details.cancel()` keeps the file as it was. */
export type ReactDemoEditorValueChangeReason = "input-change"
export type ReactDemoEditorValueChangeDetails = ChangeDetails<ReactDemoEditorValueChangeReason>

export interface ReactDemoEditorProps {
  /** Source files keyed by their project-relative or absolute paths. */
  files: Readonly<Record<string, string>>
  /** Vite entry file. Defaults to `/src/main.jsx`. */
  entry?: string
  /** Preview height after the user runs the demo. */
  height?: number | string
  className?: string
  /** Called with every file whenever one is edited, and why. */
  onValueChange?: (files: Record<string, string>, details: ReactDemoEditorValueChangeDetails) => void
  /**
   * Renders the running preview, e.g. `almostNodeLiveRenderer` from
   * `@brett_lamy/ui/docstream/playground` (needs `@agent-wasm/core`). The editor never loads a
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
  onValueChange,
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

  const updateFile = (content: string, event?: Event) => {
    if (!selectedFile) return
    const next = { ...draftFiles, [selectedFile]: content }
    const details = changeDetails<ReactDemoEditorValueChangeReason>({ reason: "input-change", event })
    onValueChange?.(next, details)
    if (!details.canceled) setDraftFiles(next)
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
            <Glyph name="play" className="size-3.5" size={24} /> Run demo
          </Button>
        )}
      </div>
      <Textarea
        className="gb-react-demo-textarea"
        value={selectedFile ? draftFiles[selectedFile] ?? "" : ""}
        onValueChange={(content, details) => updateFile(content, details.event)}
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
            <Glyph name="doc-code" className="size-4" size={24} />
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
