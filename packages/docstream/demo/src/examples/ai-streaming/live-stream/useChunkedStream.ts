import { useEffect, useRef, useState } from "react"

/** Chunk sizes like a model's tokens: 1–8 characters, deterministic so every replay matches. */
function chunkSizes(length: number): number[] {
  const sizes: number[] = []
  let seed = 7
  for (let total = 0; total < length; ) {
    seed = (seed * 9301 + 49297) % 233280
    const size = 1 + Math.floor((seed / 233280) * 8)
    sizes.push(size)
    total += size
  }
  return sizes
}

export interface ChunkedStream {
  /** Everything received so far — what you'd hand to `GitbookStreamdown`. */
  text: string
  done: boolean
  playing: boolean
  toggle: () => void
  restart: () => void
}

/** Replays `source` a chunk at a time, every `interval` ms. */
export function useChunkedStream(source: string, interval: number): ChunkedStream {
  const [chunk, setChunk] = useState(0)
  const [playing, setPlaying] = useState(true)
  const sizes = useRef<number[]>([])
  const offsets = useRef<number[]>([0])

  // A new source starts from the top.
  useEffect(() => {
    sizes.current = chunkSizes(source.length)
    offsets.current = sizes.current.reduce((acc, size) => [...acc, acc[acc.length - 1] + size], [0])
    setChunk(0)
    setPlaying(true)
  }, [source])

  const done = chunk >= sizes.current.length && sizes.current.length > 0
  useEffect(() => {
    if (!playing || done) return
    const timer = setInterval(() => setChunk((c) => c + 1), interval)
    return () => clearInterval(timer)
  }, [playing, done, interval])

  return {
    text: source.slice(0, offsets.current[Math.min(chunk, offsets.current.length - 1)] ?? 0),
    done,
    playing: playing && !done,
    toggle: () => (done ? (setChunk(0), setPlaying(true)) : setPlaying((p) => !p)),
    restart: () => {
      setChunk(0)
      setPlaying(true)
    },
  }
}
