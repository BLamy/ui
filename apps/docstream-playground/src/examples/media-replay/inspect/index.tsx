import { useRef, useState } from "react"
import { ReplayPreview, formatReplayTime, type ReplayPreviewHandle } from "@brett_lamy/ui/docstream"
import type { ReplayInspection } from "@brett_lamy/ui/docstream/replay"
import { replayDemoEvents } from "@brett_lamy/ui/docstream/replay/demo"

// What a debugging agent looked at in the recording, step by step. Each names a request (by URL here; a
// recording's own request id works too) or a console message (by text), and says what it found.
const chronology: (ReplayInspection & { id: string })[] = [
  { id: "promo", time: 6800, request: "/api/promo/validate?code=FALL25", label: "The promo code validates: FALL25 is 10% off." },
  { id: "deprecated", time: 7000, message: "is deprecated", label: "The promo call still sends the deprecated `code` field." },
  { id: "checkout", time: 7600, request: "/api/checkout", label: "Checkout answers 500: the server never saw the promo." },
  { id: "crash", time: 7900, message: "Uncaught TypeError", label: "applyPromo reads `total` off an undefined response." },
]

export default function InspectDemo() {
  const player = useRef<ReplayPreviewHandle>(null)
  const [time, setTime] = useState(6000)
  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 240px", gap: 16, alignItems: "start" }}>
      <ReplayPreview
        events={replayDemoEvents}
        initialTime={6000}
        inspections={chronology}
        ref={player}
        onTimeUpdate={setTime}
        title="Northwind checkout, with what was inspected"
      />
      <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 6, fontSize: 13 }}>
        {chronology.map((step, i) => (
          <li key={step.id}>
            <button
              type="button"
              onClick={() => player.current?.inspect(step.id)}
              style={{ ...button, opacity: step.time <= time ? 1 : 0.55 }}
            >
              <span style={{ fontVariantNumeric: "tabular-nums", fontWeight: 600 }}>
                {i + 1} · {formatReplayTime(step.time)}
              </span>
              <span>{step.label}</span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

const button = {
  display: "grid",
  gap: 2,
  width: "100%",
  textAlign: "left" as const,
  font: "inherit",
  padding: "6px 10px",
  borderRadius: 8,
  border: "1px solid color-mix(in oklab, currentColor 22%, transparent)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
}
