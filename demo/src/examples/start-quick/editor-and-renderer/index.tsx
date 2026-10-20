import { useState } from "react"
import { GitbookEditor } from "@brett_lamy/docstream-editor"
import { MarkdownContent } from "@brett_lamy/docstream"

const initial = `# Getting started

{% hint style="info" %}
Type \`/\` to insert a block. Everything you write shows up on the right, rendered by docstream.
{% endhint %}

- [x] Install the editor
- [ ] Write your first page
`

/* The end of the quick start: one string of state, the editor writing it, docstream reading it. */
export default function EditorAndRenderer() {
  const [markdown, setMarkdown] = useState(initial)
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
      <style>{".gb.qs-editor { max-width: none; padding: 4px 16px 16px; border: 1px solid var(--border); border-radius: 12px }"}</style>
      <GitbookEditor markdown={markdown} onChange={setMarkdown} className="qs-editor" />
      <div style={{ minWidth: 0, padding: "0 16px", border: "1px dashed var(--border)", borderRadius: 12 }}>
        <MarkdownContent markdown={markdown} />
      </div>
    </div>
  )
}
