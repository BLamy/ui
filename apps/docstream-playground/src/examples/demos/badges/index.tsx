import type { CSSProperties } from "react"

type Tone = "green" | "amber" | "red" | "blue"
type Variant = "soft" | "solid" | "outline"

const TONES: Record<Tone, string> = {
  green: "#16a34a",
  amber: "#d97706",
  red: "#dc2626",
  blue: "#2563eb",
}

const STATUSES: { label: string; tone: Tone }[] = [
  { label: "Deployed", tone: "green" },
  { label: "Building", tone: "blue" },
  { label: "Queued", tone: "amber" },
  { label: "Failed", tone: "red" },
]

function badgeStyle(tone: Tone, variant: Variant): CSSProperties {
  const color = TONES[tone]
  const base: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "4px 10px",
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.2,
  }
  if (variant === "solid") return { ...base, background: color, color: "#fff" }
  if (variant === "outline") return { ...base, boxShadow: `inset 0 0 0 1.5px ${color}`, color }
  return { ...base, background: `${color}1f`, color }
}

export default function Badges({ variant = "soft" }: { variant?: string }) {
  const look = (["soft", "solid", "outline"].includes(variant) ? variant : "soft") as Variant
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
      {STATUSES.map(({ label, tone }) => (
        <span key={label} style={badgeStyle(tone, look)}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: "currentColor" }} />
          {label}
        </span>
      ))}
    </div>
  )
}
