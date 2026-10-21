import { useMemo, useState } from "react"
import {
  DocsRenderer,
  DocumentProperties,
  parseMarkdown,
  serializeMarkdown,
  type DocumentPropertiesNode,
} from "@brett_lamy/docstream"

const START = `---
owner: dana
status: in review # comments survive edits
due: 2026-11-01
---

### Launch checklist

- [x] Copy reviewed
- [~] Load test at 2× traffic
- [b] Legal sign-off
- [ ] Announce in #launches

Right-click (or Shift+F10 on) a checkbox for every state.
`

// The document is the Markdown string. Each interaction edits the AST and serializes it back,
// so the source on the right is always exactly what would be saved.
export default function EditableDocument() {
  const [markdown, setMarkdown] = useState(START)
  const doc = useMemo(() => parseMarkdown(markdown), [markdown])

  const setProperties = (properties: DocumentPropertiesNode) =>
    setMarkdown(serializeMarkdown({ ...doc, properties }))

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
      <div>
        {doc.properties ? (
          <DocumentProperties properties={doc.properties} onChange={setProperties} defaultOpen />
        ) : null}
        <DocsRenderer
          doc={doc}
          documentProperties={false}
          onTaskStateChange={(item, state) => {
            // `item` is the ListItemNode inside `doc`: change it in place, then write the doc back.
            item.state = state
            item.checked = state === "verified"
            setMarkdown(serializeMarkdown(doc))
          }}
        />
      </div>
      <pre
        aria-label="Markdown source"
        style={{
          margin: 0,
          padding: 12,
          borderRadius: 8,
          background: "rgba(128,128,128,.1)",
          fontFamily: "ui-monospace, Menlo, monospace",
          fontSize: 12.5,
          lineHeight: 1.55,
          whiteSpace: "pre-wrap",
          overflow: "auto",
        }}
      >
        {markdown}
      </pre>
    </div>
  )
}
