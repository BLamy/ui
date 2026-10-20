import { useMemo, useState, type CSSProperties } from "react"
import {
  DocsRenderer,
  documentOutline,
  flattenForPlainMarkdown,
  parseMarkdown,
  serializeMarkdown,
} from "@brett_lamy/docstream"

const START = `---
title: Explorer
---

# Parser explorer

Edit me — *any* spelling survives: __bold__, \`code\`, [a ref][docs], <https://example.com>.

{% hint style="success" %}
Hints, tabs and steppers are **real nodes**.
{% endhint %}

{% tabs title="Install" sync="pm" %}
{% tab title="npm" %}
{% command %}npm install @brett_lamy/docstream{% endcommand %}
{% endtab %}
{% endtabs %}

* [x] starred bullets stay starred
* [~] task states too

Cited claim [^1], ask @brett.

[docs]: https://blamy.github.io/ui/#/docstream

[^1]: https://example.com/source "A source"
`

const VIEWS = ["Rendered", "AST", "Serialized", "Outline", "Plain"] as const
type View = (typeof VIEWS)[number]

const mono: CSSProperties = {
  fontFamily: "ui-monospace, Menlo, monospace",
  fontSize: 12.5,
  lineHeight: 1.5,
}

export default function ParserExplorer() {
  const [source, setSource] = useState(START)
  const [view, setView] = useState<View>("AST")

  const doc = useMemo(() => parseMarkdown(source), [source])
  const serialized = useMemo(() => serializeMarkdown(doc), [doc])
  // A missing final newline is added on serialize; everything else must come back byte-for-byte.
  const identical = serialized === source || serialized === `${source}\n`

  const output =
    view === "AST"
      ? JSON.stringify(doc, null, 2)
      : view === "Serialized"
        ? serialized
        : view === "Outline"
          ? JSON.stringify(documentOutline(doc), null, 2)
          : view === "Plain"
            ? serializeMarkdown(flattenForPlainMarkdown(doc))
            : null

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, height: "100%" }}>
      <label style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 6, minHeight: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600 }}>Markdown</span>
        <textarea
          value={source}
          onChange={(event) => setSource(event.currentTarget.value)}
          spellCheck={false}
          style={{ ...mono, minHeight: 360, padding: 10, borderRadius: 8, border: "1px solid rgba(128,128,128,.35)", background: "transparent", color: "inherit", resize: "vertical" }}
        />
      </label>
      <div style={{ display: "grid", gridTemplateRows: "auto 1fr", gap: 6, minHeight: 0 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              style={{ fontSize: 12, padding: "2px 8px", borderRadius: 6, fontWeight: view === v ? 700 : 400 }}
            >
              {v}
            </button>
          ))}
          <span
            role="status"
            style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, color: identical ? "#16a34a" : "#dc2626" }}
          >
            {identical ? "✓ round-trip identical" : "✗ round-trip differs"}
          </span>
        </div>
        {output === null ? (
          <div style={{ overflow: "auto", maxHeight: 420, border: "1px solid rgba(128,128,128,.25)", borderRadius: 8, padding: "0 12px" }}>
            <DocsRenderer doc={doc} documentProperties={{ defaultOpen: true }} />
          </div>
        ) : (
          <pre style={{ ...mono, margin: 0, overflow: "auto", maxHeight: 420, padding: 10, borderRadius: 8, background: "rgba(128,128,128,.1)" }}>
            {output}
          </pre>
        )}
      </div>
    </div>
  )
}
