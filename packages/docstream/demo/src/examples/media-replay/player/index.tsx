import { useMemo, useRef, useState } from "react"
import { ReplayPreview, formatReplayTime, type ReplayPreviewHandle } from "@brett_lamy/docstream"
import { getReplayMarkers, getReplayMeta } from "@brett_lamy/docstream/replay"
import { replayDemoEvents } from "@brett_lamy/docstream/replay/demo"

type Chrome = "browser" | "minimal" | "none"

export default function ReplayPlayerDemo({ variant = "browser" }: { variant?: string }) {
  const chrome = (["browser", "minimal", "none"].includes(variant) ? variant : "browser") as Chrome
  const player = useRef<ReplayPreviewHandle>(null)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [pressed, setPressed] = useState<string | null>(null)

  // Pure readers over the event list: no rrweb needed to draw these.
  const meta = useMemo(() => getReplayMeta(replayDemoEvents), [])
  const markers = useMemo(() => getReplayMarkers(replayDemoEvents), [])

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <ReplayPreview
        events={replayDemoEvents}
        chrome={chrome}
        playerRef={player}
        onTimeUpdate={setTime}
        onPlayingChange={setPlaying}
        onMarkerPress={(m) => setPressed(`${m.kind}: ${m.label}`)}
        title="Northwind checkout recording"
      />
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 13 }}>
        <button type="button" onClick={() => player.current?.toggle()} style={button}>
          {playing ? "Pause" : "Play"}
        </button>
        <span style={{ fontVariantNumeric: "tabular-nums" }}>
          {formatReplayTime(time)} / {formatReplayTime(meta.duration)} · {meta.width}×{meta.height}
        </span>
        <span style={{ opacity: 0.6 }}>Jump to:</span>
        {markers
          .filter((m) => m.kind !== "click")
          .map((m) => (
            <button key={m.id} type="button" style={button} onClick={() => player.current?.seek(m.time)}>
              {m.kind} · {m.label}
            </button>
          ))}
      </div>
      {pressed && <div style={{ fontSize: 13, opacity: 0.75 }}>onMarkerPress → {pressed}</div>}
    </div>
  )
}

const button = {
  font: "inherit",
  fontSize: 12,
  padding: "4px 10px",
  borderRadius: 8,
  border: "1px solid color-mix(in oklab, currentColor 22%, transparent)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
}
