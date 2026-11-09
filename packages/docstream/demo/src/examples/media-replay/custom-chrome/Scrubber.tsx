import type { ReplayMarker } from "@brett_lamy/docstream/replay"

const COLORS: Record<ReplayMarker["kind"], string> = {
  click: "#64748b",
  error: "#ef4444",
  network: "#f59e0b",
  navigation: "#3b82f6",
  custom: "#10b981",
}

export function Scrubber({
  time,
  duration,
  markers,
  onSeek,
}: {
  time: number
  duration: number
  markers: ReplayMarker[]
  onSeek: (ms: number) => void
}) {
  const pct = (ms: number) => `${duration ? (ms / duration) * 100 : 0}%`
  return (
    <div className="cc-scrubber">
      <input
        type="range"
        min={0}
        max={duration || 1}
        step={10}
        value={time}
        onChange={(e) => onSeek(Number(e.currentTarget.value))}
        aria-label="Seek"
      />
      <div className="cc-progress" style={{ width: pct(time) }} />
      {markers.map((m) => (
        <button
          key={m.id}
          type="button"
          className="cc-marker"
          title={`${m.kind}: ${m.label}${m.detail ? ` (${m.detail})` : ""}`}
          style={{ left: pct(m.time), background: COLORS[m.kind] }}
          onClick={() => onSeek(m.time)}
        />
      ))}
    </div>
  )
}
