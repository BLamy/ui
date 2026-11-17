import { useEditorState, type Editor } from "@tiptap/react"
import { Extension } from "@tiptap/core"
import type { ReactNode } from "react"
import type { DocumentPropertiesNode } from "@brett_lamy/ui/docstream/gitbook"
import { readDocumentProperties } from "@brett_lamy/ui/docstream/gitbook"
import { DocstreamEnvProvider, envNamesFromProperties, type DocstreamEnvHost } from "@brett_lamy/ui/docstream"
import { DocumentProperties } from "@brett_lamy/ui/docstream/properties"

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    documentProperties: {
      /** Set frontmatter as document metadata. This participates in undo/redo and normal onChange. */
      setDocumentProperties: (properties: DocumentPropertiesNode | null) => ReturnType
    }
  }
}

/** Document-level metadata, independent of the editable body and retained by every schema round-trip. */
export const GbDocumentProperties = Extension.create({
  name: "gbDocumentProperties",
  addGlobalAttributes() {
    return [{ types: ["doc"], attributes: { properties: { default: null, rendered: false } } }]
  },
  addCommands() {
    return {
      setDocumentProperties: (properties) => ({ tr, dispatch }) => {
        if (dispatch) tr.setDocAttribute("properties", properties)
        return true
      },
    }
  },
})

export function DocumentPropertiesEditor({ editor, defaultOpen = false }: { editor: Editor; defaultOpen?: boolean }) {
  const state = useEditorState({ editor, selector: ({ editor }) => ({ properties: editor.state.doc.attrs.properties as DocumentPropertiesNode | null, editable: editor.isEditable }) })
  if (!state.properties) return null
  return <DocumentProperties properties={state.properties} defaultOpen={defaultOpen}
    onValueChange={state.editable ? (properties) => { editor.commands.setDocumentProperties(properties) } : undefined} />
}

/**
 * The document's `env` property for the examples inside the editor: a `{% demo %}` that uses one of the declared
 * variables waits behind docstream's gate until `envHost` (or the reader) supplies it, as it does in a rendered page.
 */
export function DocumentEnvScope({ editor, envHost, children }: { editor: Editor; envHost?: DocstreamEnvHost; children: ReactNode }) {
  const names = useEditorState({
    editor,
    selector: ({ editor }) => {
      const properties = editor.state.doc.attrs.properties as DocumentPropertiesNode | null
      return properties ? envNamesFromProperties(readDocumentProperties(properties).values).join(",") : ""
    },
  })
  if (!names && !envHost) return <>{children}</>
  return <DocstreamEnvProvider declared={names ? names.split(",") : []} host={envHost}>{children}</DocstreamEnvProvider>
}
