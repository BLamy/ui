import { useState } from "react"
import { embedBlockFor, markdownPasteContent } from "@brett_lamy/docstream-editor"

const PASTES: Record<string, string> = {
  Prose: "Just a sentence with **bold** and a [link](https://example.com).",
  "A heading": "## Release notes\n\nShipped on Thursday.",
  "A hint": '{% hint style="info" %}\nPasted from a docs page.\n{% endhint %}',
  "A citation": "Up 18% [^1].\n\n[^1]: https://scoopdata.io/q3 \"ScoopData\"",
  "A fence": "```ts\nconst answer = 42\n```",
}
const URLS = ["./photos/hero.png", "https://youtu.be/aqz-KE-bpKQ", "./models/case%20v2.stl", "./session.rrweb"]

const mono = { font: "12px/1.55 ui-monospace, 'SF Mono', Menlo, monospace" }
const field = { ...mono, width: "100%", boxSizing: "border-box" as const, padding: 10, borderRadius: 10, border: "1px solid var(--border)", background: "var(--card)", color: "inherit" }
const out = { ...mono, margin: 0, padding: 12, maxHeight: 240, overflow: "auto", borderRadius: 10, background: "var(--muted)", whiteSpace: "pre-wrap" as const }
const chip = (active: boolean) => ({ font: "inherit", padding: "3px 10px", borderRadius: 999, cursor: "pointer", color: "inherit", border: "1px solid var(--border)", background: active ? "var(--accent)" : "var(--card)" })

/* `markdownPasteContent` decides what `markdownPaste` does with a plain-text paste;
   `embedBlockFor` is the block a dropped or uploaded URL becomes. */
export default function Conversion({ variant = "paste" }: { variant?: string }) {
  const [text, setText] = useState(PASTES["A hint"]!)
  const [url, setUrl] = useState(URLS[0]!)

  if (variant === "embed") {
    return (
      <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {URLS.map((u) => <button key={u} type="button" style={chip(u === url)} onClick={() => setUrl(u)}>{u}</button>)}
        </div>
        <input value={url} onChange={(e) => setUrl(e.target.value)} aria-label="URL" style={field} />
        <pre style={out}>{`embedBlockFor(${JSON.stringify(url)})\n\n${JSON.stringify(embedBlockFor(url), null, 2)}`}</pre>
      </div>
    )
  }

  const result = markdownPasteContent(text)
  return (
    <div style={{ display: "grid", gap: 10, fontSize: 13 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {Object.entries(PASTES).map(([name, value]) => <button key={name} type="button" style={chip(value === text)} onClick={() => setText(value)}>{name}</button>)}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} spellCheck={false} aria-label="Clipboard text" style={{ ...field, resize: "vertical" }} />
      <strong>
        {result
          ? `→ ${result.content.length} block${result.content.length === 1 ? "" : "s"}: ${result.content.map((n) => n.type).join(", ")}${result.citations ? ` + ${result.citations.length} citation definition(s)` : ""}`
          : "→ null: plain prose, pasted as text"}
      </strong>
      <pre style={out}>{JSON.stringify(result, null, 2)}</pre>
    </div>
  )
}
