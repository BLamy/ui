import { useMemo, useRef, useState } from "react"
import { formatReplayTime } from "@brett_lamy/docstream"
import {
  ReplayStage,
  getReplayMarkers,
  getReplayPointerTrack,
  replayPointerAt,
  type ReplayStageHandle,
} from "@brett_lamy/docstream/replay"
import { replayDemoEvents } from "@brett_lamy/docstream/replay/demo"
import { Scrubber } from "./Scrubber"
import "./custom-chrome.css"

// Your own player: the headless stage plays the page, everything around it is yours.
export default function CustomChrome() {
  const stage = useRef<ReplayStageHandle>(null)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)

  const markers = useMemo(() => getReplayMarkers(replayDemoEvents), [])
  const track = useMemo(() => getReplayPointerTrack(replayDemoEvents), [])
  const pointer = replayPointerAt(track, time)
  // A click "lands" for 400 ms after it happens.
  const clicking = track.clicks.some((c) => time >= c.time && time - c.time < 400)

  return (
    <div className="cc">
      <div className="cc-screen">
        <ReplayStage
          ref={stage}
          events={replayDemoEvents}
          speed={speed}
          showMouse={false}
          onReady={({ duration }) => setDuration(duration)}
          onTimeUpdate={setTime}
          onPlayingChange={setPlaying}
          fallback={<div className="cc-loading">Loading rrweb…</div>}
          overlay={
            pointer && (
              <div
                className="cc-pointer"
                data-clicking={clicking || undefined}
                style={{ transform: `translate(${pointer.x}px, ${pointer.y}px) scale(calc(1 / var(--replay-scale)))` }}
              />
            )
          }
        />
      </div>
      <div className="cc-bar">
        <button type="button" onClick={() => stage.current?.toggle()}>{playing ? "❚❚" : "▶"}</button>
        <Scrubber time={time} duration={duration} markers={markers} onSeek={(ms) => stage.current?.seek(ms)} />
        <span className="cc-time">{formatReplayTime(time)}</span>
        <button type="button" onClick={() => setSpeed((s) => (s >= 4 ? 1 : s * 2))}>{speed}×</button>
      </div>
    </div>
  )
}
