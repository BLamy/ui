import { useMemo, useState } from "react"
import { astToTiptap, getGitbookSchema, type PMNode } from "@brett_lamy/docstream-editor"
import { parseMarkdown } from "@brett_lamy/docstream/gitbook"
import { MONO, Pane, Split } from "./ui"

const START = `# Release 2.0

{% hint style="success" %}
Shipped on **Monday**. Thanks @ada!
{% endhint %}

- [x] Changelog
- [ ] Blog post

{% embed url="./demo.rrweb" %}
`

// Built once: the exact schema GitbookEditor uses (createGitbookExtensions({ slashMenu: false })).
const schema = getGitbookSchema()

function outline(node: PMNode, depth = 0): string[] {
  const attrs = Object.entries(node.attrs ?? {}).filter(([k, v]) => v !== null && v !== "" && k !== "md")
  const label = node.type === "text" ? JSON.stringify(node.text) : node.type
  const line = `${"  ".repeat(depth)}${label}${attrs.length ? ` ${attrs.map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(" ")}` : ""}${node.marks?.length ? ` [${node.marks.map((m) => m.type).join(", ")}]` : ""}`
  return [line, ...(node.content ?? []).flatMap((child) => outline(child, depth + 1))]
}

/** Markdown → editor JSON → validated against getGitbookSchema(): what a Yjs host converts through. */
export default function SchemaDemo() {
  const [markdown, setMarkdown] = useState(START)
  const result = useMemo(() => {
    try {
      const json = astToTiptap(parseMarkdown(markdown))
      const doc = schema.nodeFromJSON(json)
      doc.check() // throws on content the schema doesn't allow
      return { ok: true as const, lines: outline(json), size: doc.content.size }
    } catch (cause) {
      return { ok: false as const, error: cause instanceof Error ? cause.message : String(cause) }
    }
  }, [markdown])

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <Split>
        <Pane title="Markdown (edit me)">
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            spellCheck={false}
            aria-label="Markdown"
            style={{ width: "100%", boxSizing: "border-box", minHeight: 260, border: 0, padding: 12, fontFamily: MONO, fontSize: 12, lineHeight: 1.55, background: "transparent", color: "inherit", resize: "vertical" }}
          />
        </Pane>
        <Pane title={result.ok ? `schema.nodeFromJSON(…).check() ✓ · ${result.size} positions` : "check() failed"}>
          <pre style={{ margin: 0, padding: 12, maxHeight: 300, overflow: "auto", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.55, whiteSpace: "pre-wrap", color: result.ok ? undefined : "#dc2626" }}>
            {result.ok ? result.lines.join("\n") : result.error}
          </pre>
        </Pane>
      </Split>
      <Pane title={`getGitbookSchema(): ${Object.keys(schema.nodes).length} node types, ${Object.keys(schema.marks).length} marks`}>
        <div style={{ padding: 12, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.7 }}>
          <div>
            <strong>nodes</strong> {Object.keys(schema.nodes).join(" · ")}
          </div>
          <div>
            <strong>marks</strong> {Object.keys(schema.marks).join(" · ")}
          </div>
        </div>
      </Pane>
    </div>
  )
}
