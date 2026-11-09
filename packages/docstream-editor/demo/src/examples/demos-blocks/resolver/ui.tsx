/* Demo chrome: two panes, a live Markdown view and an event log. Not part of the editor. */
import { useCallback, useState, type CSSProperties, type ReactNode } from "react"

export const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace"

/** A data URL makes Markdown unreadable: show its type and size instead. */
export function shortenDataUrls(markdown: string): string {
  return markdown.replace(/data:([\w/+.-]+);base64,[A-Za-z0-9+/=]+/g, (url, type: string) => `data:${type};base64,…(${Math.max(1, Math.round((url.length * 0.75) / 1024))} KB)`)
}

export function Split({ children }: { children: ReactNode }) {
  return <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 12, alignItems: "start" }}>{children}</div>
}

export function Pane({ title, actions, children, style }: { title: ReactNode; actions?: ReactNode; children: ReactNode; style?: CSSProperties }) {
  return (
    <section style={{ border: "1px solid var(--border, #e4e4ea)", borderRadius: 10, overflow: "hidden", minWidth: 0, background: "var(--card, transparent)", ...style }}>
      <header style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "6px 12px", borderBottom: "1px solid var(--border, #e4e4ea)", fontSize: 12, fontWeight: 650, color: "var(--muted-foreground, #6e6e7a)" }}>
        <span>{title}</span>
        {actions ? <span style={{ marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap", fontWeight: 500 }}>{actions}</span> : null}
      </header>
      {children}
    </section>
  )
}

export function MarkdownPane({ markdown, title = "Markdown (live)" }: { markdown: string; title?: string }) {
  return (
    <Pane title={title}>
      <pre data-demo-markdown="" style={{ margin: 0, padding: 12, maxHeight: 360, overflow: "auto", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.55, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {shortenDataUrls(markdown) || "(empty)"}
      </pre>
    </Pane>
  )
}

export interface LogEntry {
  id: number
  time: string
  text: string
}

/** An append-only event log: `[entries, log]`. */
export function useLog(): [LogEntry[], (text: string) => void] {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const log = useCallback((text: string) => {
    const now = new Date()
    const time = `${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}.${String(now.getMilliseconds()).padStart(3, "0")}`
    setEntries((all) => [...all.slice(-49), { id: (all[all.length - 1]?.id ?? 0) + 1, time, text }])
  }, [])
  return [entries, log]
}

export function LogPane({ entries, title = "Host callbacks", empty = "Nothing yet." }: { entries: LogEntry[]; title?: string; empty?: string }) {
  return (
    <Pane title={title}>
      <ol data-demo-log="" style={{ listStyle: "none", margin: 0, padding: "8px 12px", maxHeight: 200, overflow: "auto", fontFamily: MONO, fontSize: 11.5, lineHeight: 1.6 }}>
        {entries.length ? (
          [...entries].reverse().map((e) => (
            <li key={e.id} style={{ overflowWrap: "anywhere" }}>
              <span style={{ opacity: 0.5 }}>{e.time}</span> {e.text}
            </li>
          ))
        ) : (
          <li style={{ opacity: 0.6 }}>{empty}</li>
        )}
      </ol>
    </Pane>
  )
}

export function Button({ onClick, children, disabled }: { onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{ font: "inherit", fontSize: 12, padding: "3px 10px", borderRadius: 6, border: "1px solid var(--border, #e4e4ea)", background: "var(--background, #fff)", color: "inherit", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.5 : 1 }}
    >
      {children}
    </button>
  )
}
