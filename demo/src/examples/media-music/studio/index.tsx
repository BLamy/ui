import { useState } from "react"
import { StrudelPlayer, type StrudelCodeChangeDetails } from "@brett_lamy/docstream"
import { SONGS } from "./songs"

// The rack edits the code; onCodeChange hands every edit back so a host can save it, with what made it.
export default function Studio({ variant = "labels" }: { variant?: string }) {
  const song = SONGS[variant as keyof typeof SONGS] ?? SONGS.labels
  const [code, setCode] = useState<string | null>(null)
  const [why, setWhy] = useState("")
  const onCodeChange = (next: string, { reason, rack }: StrudelCodeChangeDetails) => {
    setCode(next)
    setWhy(rack ? `${rack.control}${rack.param ? ` ${rack.param}` : ""} · ${rack.reason}` : reason)
  }

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <StrudelPlayer key={variant} code={song.code} title={song.title} defaultRackOpen onCodeChange={onCodeChange} />
      <details open={code !== null} style={{ fontSize: 13 }}>
        <summary style={{ cursor: "pointer" }}>
          {code === null ? "Turn a knob: the edited code appears here" : `onCodeChange → the code after your last edit (${why})`}
        </summary>
        <pre style={{ margin: "8px 0 0", padding: 12, borderRadius: 8, overflowX: "auto", background: "color-mix(in oklab, currentColor 6%, transparent)" }}>
          {(code ?? song.code).trim()}
        </pre>
      </details>
    </div>
  )
}
