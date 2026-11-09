import { useMemo, useState, type CSSProperties, type ReactNode } from "react"
import {
  GitbookEditor,
  astToTiptap,
  getGitbookSchema,
  serializeEditorMarkdown,
  tiptapToAst,
  type GitbookEditorProps,
  type PMNode,
} from "@brett_lamy/docstream-editor"
import { parseMarkdown } from "@brett_lamy/docstream/gitbook"

/** The TipTap editor instance `onEditorReady` hands over. */
export type EditorInstance = NonNullable<Parameters<NonNullable<GitbookEditorProps["onEditorReady"]>>[0]>

export interface Sample {
  label: string
  /** The starting document. */
  markdown: string
  /** One line telling the reader what to try. */
  tip?: string
  /** Extra GitbookEditor props for this sample (read once, when the editor mounts). */
  props?: Partial<GitbookEditorProps>
  /** Buttons above the editor that drive it through its commands. */
  controls?: (editor: EditorInstance) => ReactNode
}

/** What the editor writes for `markdown` once it has loaded it: parse → editor schema → serialize. */
export function throughEditor(markdown: string): string {
  const doc = parseMarkdown(markdown)
  const node = getGitbookSchema().nodeFromJSON(astToTiptap(doc))
  const ast = tiptapToAst(node.toJSON() as PMNode)
  // GitbookEditor keeps footnote definitions beside the document; do the same here.
  if (doc.citations?.length) ast.citations = doc.citations
  return serializeEditorMarkdown(ast)
}

const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"
const pane: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  border: "1px solid var(--border, #e4e4ea)",
  borderRadius: 10,
  overflow: "hidden",
  background: "var(--background, #fff)",
}
const head: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "6px 10px",
  borderBottom: "1px solid var(--border, #e4e4ea)",
  background: "var(--muted, #f4f4f6)",
  color: "var(--muted-foreground, #6e6e7a)",
  fontSize: 12,
  fontWeight: 600,
}
const badge = (ok: boolean): CSSProperties => ({
  marginLeft: "auto",
  padding: "1px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: 500,
  color: ok ? "#15803d" : "#b45309",
  background: ok ? "rgba(34, 197, 94, 0.12)" : "rgba(245, 158, 11, 0.14)",
})
const button: CSSProperties = {
  font: "inherit",
  fontSize: 12,
  padding: "3px 10px",
  borderRadius: 6,
  border: "1px solid var(--border, #e4e4ea)",
  background: "var(--background, #fff)",
  color: "inherit",
  cursor: "pointer",
}

// Side by side when there's room; stacked, with a shorter Markdown pane, in a narrow column.
const CSS = `
.gbw-grid { display: grid; gap: 12px; grid-template-columns: minmax(0, 1fr); }
.gbw-editor { height: var(--gbw-h); }
.gbw-markdown { height: 200px; }
@container (min-width: 860px) {
  .gbw-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .gbw-markdown { height: var(--gbw-h); }
}
.gb-workbench-btn:hover { background: var(--muted, #f4f4f6); }
`

/**
 * A GitbookEditor and the Markdown it serializes, side by side and both editable: edit the
 * document and the Markdown follows on every keystroke; edit the Markdown and the editor reloads it.
 */
export function Workbench({ sample, height = 440 }: { sample: Sample; height?: number }) {
  const [markdown, setMarkdown] = useState(sample.markdown)
  const [seed, setSeed] = useState(sample)
  const [editor, setEditor] = useState<EditorInstance | null>(null)
  const [generation, setGeneration] = useState(0)
  if (seed !== sample) {
    // A new variant: start over from its document.
    setSeed(sample)
    setMarkdown(sample.markdown)
    setGeneration((n) => n + 1)
  }
  // An empty document is written as a lone newline; nothing worth flagging.
  const roundTrips = useMemo(() => !markdown || throughEditor(markdown) === markdown, [markdown])
  const edited = markdown !== sample.markdown

  return (
    <div className="gbw" style={{ display: "grid", gap: 10, containerType: "inline-size", ["--gbw-h" as string]: `${height}px` }}>
      {sample.tip || sample.controls ? (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 13 }}>
          {sample.tip ? <span style={{ color: "var(--muted-foreground, #6e6e7a)" }}>{sample.tip}</span> : null}
          {sample.controls && editor ? <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{sample.controls(editor)}</span> : null}
        </div>
      ) : null}
      <div className="gbw-grid">
        <section style={pane} aria-label="Editor">
          <div style={head}>
            Editor
            <button
              type="button"
              style={{ ...button, marginLeft: "auto", visibility: edited ? "visible" : "hidden" }}
              onClick={() => {
                setMarkdown(sample.markdown)
                setGeneration((n) => n + 1)
              }}
            >
              Reset
            </button>
          </div>
          <div className="gbw-editor" style={{ overflow: "auto", padding: "4px 14px 14px" }}>
            <GitbookEditor
              // Props are read when the editor mounts: a new variant or a reset mounts a fresh one.
              key={generation}
              markdown={markdown}
              onChange={setMarkdown}
              onEditorReady={setEditor}
              {...sample.props}
            />
          </div>
        </section>
        <section style={pane} aria-label="Markdown">
          <div style={head}>
            Markdown
            <span style={badge(roundTrips)} title="Parse this Markdown, load it into the editor's schema, serialize it again">
              {roundTrips ? "round-trips byte for byte" : "the editor rewrites this"}
            </span>
          </div>
          <textarea
            value={markdown}
            spellCheck={false}
            aria-label="Serialized Markdown"
            onChange={(event) => setMarkdown(event.currentTarget.value)}
            className="gbw-markdown"
            style={{
              boxSizing: "content-box",
              padding: "10px 12px",
              border: 0,
              outline: "none",
              resize: "none",
              background: "transparent",
              color: "inherit",
              fontFamily: MONO,
              fontSize: 12,
              lineHeight: 1.55,
              whiteSpace: "pre",
              overflow: "auto",
            }}
          />
        </section>
      </div>
      <style>{CSS}</style>
    </div>
  )
}

/** A small button for `Sample.controls`. */
export function Control({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="gb-workbench-btn" style={button} onMouseDown={(event) => event.preventDefault()} onClick={onClick}>
      {children}
    </button>
  )
}
