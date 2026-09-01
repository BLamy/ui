import { createContext, useContext, type ReactNode } from "react"

import type { SourceFileSnapshot, SourceReferenceClient } from "@brett_lamy/docstream/source"

export interface EditorRuntimeOptions {
  sourceClient?: SourceReferenceClient
  sourcePreview?: boolean
  sourceAutoSave?: boolean | number
  onSourceSaved?: (snapshot: SourceFileSnapshot) => void
  onSourceError?: (error: Error) => void
}

const EditorRuntimeContext = createContext<EditorRuntimeOptions>({})

export function EditorRuntimeProvider({ value, children }: { value: EditorRuntimeOptions; children: ReactNode }) {
  return <EditorRuntimeContext.Provider value={value}>{children}</EditorRuntimeContext.Provider>
}

export function useEditorRuntime(): EditorRuntimeOptions {
  return useContext(EditorRuntimeContext)
}
