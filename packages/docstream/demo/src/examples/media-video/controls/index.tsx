import { useState } from "react"
import { VideoEmbed } from "@brett_lamy/docstream"

// The same component behind `{% embed %}` for videos: a direct file becomes a native <video>,
// anything else (a YouTube embed URL) a lazy <iframe>.
const SOURCES = {
  mp4: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
  webm: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm",
  youtube: "https://www.youtube.com/embed/aqz-KE-bpKQ",
}

type Flag = "controls" | "autoplay" | "loop" | "muted"

export default function VideoControls({ variant = "mp4" }: { variant?: string }) {
  const kind = (variant in SOURCES ? variant : "mp4") as keyof typeof SOURCES
  const [flags, setFlags] = useState<Record<Flag, boolean>>({ controls: true, autoplay: false, loop: true, muted: true })
  const [poster, setPoster] = useState(true)
  const direct = kind !== "youtube"
  const toggle = (flag: Flag) => setFlags((f) => ({ ...f, [flag]: !f[flag] }))

  return (
    <div style={{ display: "grid", gap: 12, maxWidth: 640, margin: "0 auto" }}>
      <VideoEmbed
        // Remount when the flags change: autoplay and poster only apply on load.
        key={`${kind}-${JSON.stringify(flags)}-${poster}`}
        src={SOURCES[kind]}
        title={kind === "youtube" ? "Big Buck Bunny" : "A flower opening"}
        {...flags}
        {...(poster && direct ? { poster: `${import.meta.env.BASE_URL}media/flower-poster.jpg` } : {})}
      />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13 }}>
        {(Object.keys(flags) as Flag[]).map((flag) => (
          <label key={flag} style={chip(direct)}>
            <input type="checkbox" checked={flags[flag]} disabled={!direct} onChange={() => toggle(flag)} /> {flag}
          </label>
        ))}
        <label style={chip(direct)}>
          <input type="checkbox" checked={poster} disabled={!direct} onChange={() => setPoster((p) => !p)} /> poster
        </label>
      </div>
      <code style={{ fontSize: 12, opacity: 0.75, overflowWrap: "anywhere" }}>
        {direct
          ? `<VideoEmbed src="…/flower.${kind}" controls={${flags.controls}} autoplay={${flags.autoplay}} loop={${flags.loop}} muted={${flags.muted}}${poster ? ' poster="…"' : ""} />`
          : `<VideoEmbed src="${SOURCES.youtube}" />  // iframe: the flags don't apply`}
      </code>
    </div>
  )
}

const chip = (enabled: boolean) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "4px 10px",
  borderRadius: 999,
  border: "1px solid color-mix(in oklab, currentColor 20%, transparent)",
  opacity: enabled ? 1 : 0.45,
})
