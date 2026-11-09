import { useState } from "react"
import { SLASH_ITEMS } from "@brett_lamy/docstream-editor"

/**
 * The menu's filter, on its own: an item matches when its title and keywords, lower-cased,
 * contain what you typed after the `/` — the same test createSlashMenu runs.
 */
export default function SlashFilter() {
  const [query, setQuery] = useState("")
  const matches = SLASH_ITEMS.filter((item) => `${item.title} ${item.keywords}`.toLowerCase().includes(query.toLowerCase()))
  return (
    <div style={{ display: "grid", gap: 10, maxWidth: 560 }}>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 14 }}>
        <span aria-hidden="true">/</span>
        <input
          value={query}
          placeholder="type to filter: list, code, cite, chart…"
          aria-label="Slash query"
          onChange={(event) => setQuery(event.currentTarget.value)}
          style={{ flex: 1, font: "inherit", padding: "6px 8px", borderRadius: 6, border: "1px solid var(--border, #e4e4ea)", background: "var(--background, #fff)", color: "inherit" }}
        />
        <span style={{ fontSize: 12, color: "var(--muted-foreground, #6e6e7a)" }}>
          {matches.length} / {SLASH_ITEMS.length}
        </span>
      </label>
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 2, maxHeight: 360, overflow: "auto" }}>
        {matches.map((item) => (
          <li key={item.title} style={{ display: "grid", gridTemplateColumns: "20px 150px 1fr", alignItems: "center", gap: 8, padding: "4px 6px", fontSize: 13 }}>
            <item.icon size={16} aria-hidden="true" />
            <strong style={{ fontWeight: 500 }}>{item.title}</strong>
            <code style={{ fontSize: 12, color: "var(--muted-foreground, #6e6e7a)" }}>{item.keywords}</code>
          </li>
        ))}
        {matches.length === 0 ? <li style={{ padding: "4px 6px", fontSize: 13, color: "var(--muted-foreground, #6e6e7a)" }}>No matching blocks</li> : null}
      </ul>
    </div>
  )
}
