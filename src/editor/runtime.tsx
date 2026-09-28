import { createContext, useContext, type ReactNode } from "react"

import type { LivePreviewRenderer } from "@brett_lamy/docstream"
import type { DemoResolver, InlineDemoRuntime } from "@brett_lamy/docstream/demo"
import type { SourceFileSnapshot, SourceReferenceClient } from "@brett_lamy/docstream/source"
import type { EditorAttachment } from "./attachments"

export interface EditorRuntimeOptions {
  sourceClient?: SourceReferenceClient
  sourcePreview?: boolean
  sourceAutoSave?: boolean | number
  onSourceSaved?: (snapshot: SourceFileSnapshot) => void
  onSourceError?: (error: Error) => void
  demoResolver?: DemoResolver
  demoRuntime?: InlineDemoRuntime
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
