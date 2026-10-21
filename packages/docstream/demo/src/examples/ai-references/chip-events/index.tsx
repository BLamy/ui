import { useContext, useMemo, useState, type ReactNode } from "react"
import { DocstreamRefContext, MarkdownContent, type DocstreamRefContextValue, type ReferenceNode } from "@brett_lamy/docstream"
import { PEOPLE, SAMPLE } from "./sample"

/** `renderReference` override: mentions become avatar chips; everything else falls back (null). */
function renderPerson(ref: ReferenceNode, onClick: (ref: ReferenceNode) => void): ReactNode | null {
  if (ref.kind !== "mention") return null
  const person = PEOPLE[ref.id]
  return (
    <button
      type="button"
      onClick={() => onClick(ref)}
      title={person ? `${person.name} · ${person.role}` : ref.id}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "1px 8px 1px 2px",
        borderRadius: 999,
        border: "1px solid var(--gb-border)",
        background: "var(--gb-panel)",
        color: "inherit",
        font: "inherit",
        fontSize: "0.92em",
        cursor: "pointer",
        verticalAlign: "baseline",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          width: 18,
          height: 18,
          borderRadius: 999,
          fontSize: 10,
          fontWeight: 700,
          color: "#fff",
          background: person?.color ?? "#71717a",
        }}
      >
        {(person?.name ?? ref.id).slice(0, 1).toUpperCase()}
      </span>
      {person?.name ?? ref.id}
    </button>
  )
}

export default function ChipEvents({ variant = "default" }: { variant?: string }) {
  const [log, setLog] = useState<string[]>([])
  const outer = useContext(DocstreamRefContext) // keeps the site's citation previews
  const record = (ref: ReferenceNode) =>
    setLog((lines) => [`${ref.kind} · ${ref.id}${ref.url ? ` · ${ref.url}` : ""}`, ...lines].slice(0, 6))

  const value = useMemo<DocstreamRefContextValue>(
    () => ({
      ...outer,
      onReferenceClick: record,
      ...(variant === "custom" ? { renderReference: (ref) => renderPerson(ref, record) } : {}),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [outer, variant],
  )

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <DocstreamRefContext.Provider value={value}>
        <MarkdownContent markdown={SAMPLE} documentProperties={false} />
      </DocstreamRefContext.Provider>
      <div style={{ borderTop: "1px solid var(--gb-border)", paddingTop: 10, fontSize: 12.5 }}>
        <strong>onReferenceClick</strong>
        {log.length ? (
          <ol style={{ margin: "6px 0 0", paddingLeft: 18, fontFamily: "var(--docs-demo-mono, ui-monospace, monospace)" }}>
            {log.map((line, i) => <li key={i}>{line}</li>)}
          </ol>
        ) : (
          <p style={{ margin: "6px 0 0", color: "var(--gb-muted-foreground)" }}>Click a chip or a citation badge.</p>
        )}
      </div>
    </div>
  )
}
