import { useEditorState, type Editor } from "@tiptap/react"
import { Extension } from "@tiptap/core"
import type { DocumentPropertiesNode } from "@brett_lamy/docstream/gitbook"
import { DocumentProperties } from "@brett_lamy/docstream/properties"

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
    onChange={state.editable ? (properties) => { editor.commands.setDocumentProperties(properties) } : undefined} />
}
