import { useMemo, useState } from "react"
import { parseMarkdown } from "@brett_lamy/docstream/gitbook"
import { astToTiptap, getGitbookSchema, serializeEditorMarkdown, tiptapToAst, type PMNode } from "@brett_lamy/docstream-editor"
import { SAMPLES } from "./samples"

const schema = getGitbookSchema()

/** Markdown → docstream AST → editor JSON → a real ProseMirror document → back again. */
function throughEditor(markdown: string) {
  const ast = parseMarkdown(markdown)
  const json = astToTiptap(ast)
  const node = schema.nodeFromJSON(json) // the exact schema GitbookEditor uses: invalid content throws
  const back = tiptapToAst(node.toJSON() as PMNode)
  // ProseMirror has nowhere to keep footnote definitions; GitbookEditor carries them across like this.
  if (ast.citations?.length) back.citations = ast.citations
  return { ast, json, out: serializeEditorMarkdown(back) }
}

const STAGES = ["Markdown out", "Editor JSON", "docstream AST"] as const
const mono = { font: "12px/1.55 ui-monospace, 'SF Mono', Menlo, monospace" }

export default function RoundTrip() {
  const names = Object.keys(SAMPLES)
  const [input, setInput] = useState(SAMPLES[names[0]!]!)
  const [stage, setStage] = useState<(typeof STAGES)[number]>("Markdown out")
  const result = useMemo(() => {
    try {
      return { ok: true as const, ...throughEditor(input) }
    } catch (error) {
      return { ok: false as const, error: String(error) }
    }
  }, [input])
  const same = result.ok && result.out === input

  return (
    <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {names.map((name) => (
          <button key={name} type="button" onClick={() => setInput(SAMPLES[name]!)}
            style={{ font: "inherit", padding: "3px 10px", borderRadius: 999, cursor: "pointer", color: "inherit",
              border: "1px solid var(--border)", background: SAMPLES[name] === input ? "var(--accent)" : "var(--card)" }}>
            {name}
          </button>
        ))}
      </div>
      <textarea value={input} onChange={(e) => setInput(e.target.value)} spellCheck={false} rows={8} aria-label="Markdown in"
        style={{ ...mono, width: "100%", boxSizing: "border-box", padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", color: "inherit", resize: "vertical" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {STAGES.map((s) => (
          <button key={s} type="button" onClick={() => setStage(s)}
            style={{ font: "inherit", padding: "3px 10px", borderRadius: 6, cursor: "pointer", color: "inherit",
              border: "1px solid var(--border)", background: s === stage ? "var(--accent)" : "transparent" }}>
            {s}
          </button>
        ))}
        <strong style={{ marginLeft: "auto", color: same ? "#16a34a" : "#dc2626" }} data-round-trip={same ? "identical" : "changed"}>
          {!result.ok ? "schema error" : same ? "✓ byte-for-byte identical" : "✗ output differs"}
        </strong>
      </div>
      <pre style={{ ...mono, margin: 0, padding: 12, maxHeight: 260, overflow: "auto", borderRadius: 10, background: "var(--muted)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {!result.ok ? result.error : stage === "Markdown out" ? result.out : JSON.stringify(stage === "Editor JSON" ? result.json : result.ast, null, 2)}
      </pre>
    </div>
  )
}
