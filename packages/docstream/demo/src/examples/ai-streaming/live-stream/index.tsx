import { useState } from "react"
import { GitbookStreamdown, trimPartialInlineToken } from "@brett_lamy/docstream"
import { SCRIPTS } from "./scripts"
import { useChunkedStream } from "./useChunkedStream"
import "./live-stream.css"

const SPEEDS = { slow: 140, normal: 60, fast: 20 } as const
type Speed = keyof typeof SPEEDS

export default function LiveStream({ variant = "answer" }: { variant?: string }) {
  const source = SCRIPTS[variant] ?? SCRIPTS.answer
  const [speed, setSpeed] = useState<Speed>("normal")
  const [showBuffer, setShowBuffer] = useState(false)
  const stream = useChunkedStream(source, SPEEDS[speed])
  const streaming = !stream.done

  // What GitbookStreamdown parses while streaming: the buffer minus a half-arrived token.
  const parsed = streaming ? trimPartialInlineToken(stream.text) : stream.text
  const held = stream.text.slice(parsed.length)

  return (
    <div className="ls">
      <div className="ls-bar">
        <button type="button" onClick={stream.toggle}>
          {stream.done ? "Replay" : stream.playing ? "Pause" : "Resume"}
        </button>
        <button type="button" onClick={stream.restart}>Restart</button>
        <label>
          Speed
          <select value={speed} onChange={(e) => setSpeed(e.target.value as Speed)}>
            <option value="slow">Slow</option>
            <option value="normal">Normal</option>
            <option value="fast">Fast</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={showBuffer} onChange={(e) => setShowBuffer(e.target.checked)} />
          Show raw buffer
        </label>
        <span className="ls-stat" aria-live="off">
          {stream.text.length}/{source.length} chars · {streaming ? "isStreaming" : "done"}
          {held ? <> · holding back <code>{JSON.stringify(held)}</code></> : null}
        </span>
      </div>
      <div className={showBuffer ? "ls-split" : undefined}>
        {showBuffer ? (
          <pre className="ls-buffer" aria-label="Raw markdown buffer">
            {parsed}
            {held ? <mark title="Held back by trimPartialInlineToken">{held}</mark> : null}
          </pre>
        ) : null}
        <div className="ls-output">
          <GitbookStreamdown markdown={stream.text} isStreaming={streaming} isAnimating={streaming} />
        </div>
      </div>
    </div>
  )
}
