import { createContext, useContext, type ReactNode } from "react"

import type { LivePreviewRenderer } from "@brett_lamy/docstream"
import type { DemoResolver, DemoVFS, InlineDemoRuntime } from "@brett_lamy/docstream/demo"
import type { SourceFileSnapshot, SourceReferenceClient } from "@brett_lamy/docstream/source"
import type { EditorAttachment } from "./attachments"

/** What a "Choose file…" button is choosing: any file for an embed, or an image for a figure. */
export type FilePickKind = "embed" | "image"

/** The host's file chooser. Resolves to the URL to write into the document (e.g. "./models/part.stl"), or nothing when cancelled. */
export type FilePicker = (request: { kind: FilePickKind; current: string }) => Promise<string | null | undefined>

/**
 * The host's upload: store a file the user dropped, pasted or chose (copy it next to the document,
 * send it to a server) and resolve to the URL to write into the document (e.g. "./recording.rrweb"),
 * or nothing to skip it.
 */
export type FileUploader = (file: File, request: { kind: FilePickKind }) => Promise<string | null | undefined>

export interface EditorRuntimeOptions {
  pickFile?: FilePicker
  uploadFile?: FileUploader
  sourceClient?: SourceReferenceClient
  sourcePreview?: boolean
  sourceAutoSave?: boolean | number
  onSourceSaved?: (snapshot: SourceFileSnapshot) => void
  onSourceError?: (error: Error) => void
  demoResolver?: DemoResolver
  demoRuntime?: InlineDemoRuntime
  demoVFS?: DemoVFS
  liveRenderer?: LivePreviewRenderer
  demoDependencies?: Record<string, string>
  attachments?: EditorAttachment[]
  onAttachmentOpen?: (attachment: EditorAttachment) => void
}

const EditorRuntimeContext = createContext<EditorRuntimeOptions>({})

export function EditorRuntimeProvider({ value, children }: { value: EditorRuntimeOptions; children: ReactNode }) {
  return <EditorRuntimeContext.Provider value={value}>{children}</EditorRuntimeContext.Provider>
}

export function useEditorRuntime(): EditorRuntimeOptions {
  return useContext(EditorRuntimeContext)
}
