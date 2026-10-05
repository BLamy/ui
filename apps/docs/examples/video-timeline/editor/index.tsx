import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Filmstrip } from '@/components/ui/filmstrip'
import { PlaybackControls } from '@/components/ui/video-preview'
import { VideoTimeline } from '@/components/ui/video-timeline'
import { Waveform } from '@/components/ui/waveform'
import { usePlaybackClock } from '@/lib/playback'
import { clipEnd, layoutTrack, splitClip, timelineDuration, type Timeline } from '@/lib/video-timeline'

// A timeline with a magnetic main track (drag a clip among the others; trim an
// edge and the rest ripple), a free titles track and music under it. Edits come
// back through onChange once per gesture, so undo is a stack of timelines.
// The frames and peaks are drawn here; in an app they come from FFmpeg
// (useMediaFrames, useMediaPeaks).

const MEDIA = {
  beach: { name: 'Beach', kind: 'video', duration: 12, hue: 196 },
  city: { name: 'City', kind: 'video', duration: 10, hue: 32 },
  forest: { name: 'Forest', kind: 'video', duration: 14, hue: 140 },
  song: { name: 'Song', kind: 'audio', duration: 30, hue: 0 },
} as const

const card = (hue: number, n: number) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="54"><rect width="96" height="54" fill="hsl(${hue} 60% ${38 + (n % 4) * 6}%)"/><text x="48" y="34" font-size="16" font-family="sans-serif" fill="white" text-anchor="middle">${n}s</text></svg>`,
  )}`
const frames = Object.fromEntries(
  Object.entries(MEDIA).map(([id, m]) => [id, Array.from({ length: m.duration }, (_, i) => ({ time: i + 0.5, src: card(m.hue, i) }))]),
)
const peaks = Float32Array.from({ length: 30 * 40 }, (_, i) => 0.25 + 0.6 * Math.abs(Math.sin(i / 9)) * (0.6 + 0.4 * Math.sin(i / 53)))

const START: Timeline = {
  tracks: [
    { id: 'titles', kind: 'video', name: 'Titles', clips: [{ id: 't1', media: 'title', label: 'Opening title', start: 0.5, in: 0, out: 3 }] },
    layoutTrack({
      id: 'main', kind: 'video', name: 'Main', magnetic: true,
      clips: [
        { id: 'c1', media: 'beach', start: 0, in: 2, out: 7, fadeIn: 0.5 },
        { id: 'c2', media: 'city', start: 0, in: 1, out: 6, transition: 1 },
        { id: 'c3', media: 'forest', start: 0, in: 3, out: 9, transition: 0.8 },
      ],
    }),
    { id: 'music', kind: 'audio', name: 'Music', clips: [{ id: 'm1', media: 'song', start: 0, in: 4, out: 18, volume: 0.7, fadeOut: 2 }] },
  ],
}

export default function TimelineEditor() {
  const clock = usePlaybackClock()
  const [history, setHistory] = useState<Timeline[]>([START])
  const [selection, setSelection] = useState<string[]>([])
  const timeline = history[history.length - 1]
  const edit = (next: Timeline) => setHistory((h) => [...h, next])
  useEffect(() => clock.setDuration(timelineDuration(timeline)), [clock, timeline])

  // Split the selected clips (or every clip) under the playhead.
  const split = () => {
    const t = clock.getState().time
    const under = timeline.tracks.flatMap((tr) => tr.clips).filter((c) => c.start < t && t < clipEnd(c))
    const picked = under.filter((c) => selection.includes(c.id))
    edit((picked.length ? picked : under).reduce((tl, c, i) => splitClip(tl, c.id, t, `${c.id}-${history.length}-${i}`), timeline))
  }

  return (
    <div className="flex h-[340px] w-full flex-col bg-background">
      <div className="flex items-center gap-2 border-b border-border px-2 py-1">
        <PlaybackControls clock={clock} />
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onPress={split}>Split</Button>
        <Button variant="ghost" size="sm" isDisabled={history.length < 2} onPress={() => setHistory((h) => h.slice(0, -1))}>Undo</Button>
      </div>
      <VideoTimeline
        className="min-h-0 flex-1"
        timeline={timeline}
        onChange={edit}
        clock={clock}
        media={{ ...MEDIA, title: { name: 'Title', kind: 'image', duration: Infinity } }}
        selection={selection}
        onSelectionChange={setSelection}
        defaultZoom={42}
        clipClassName={(clip) => (clip.media === 'title' ? 'border-chart-5/55 bg-chart-5/25' : undefined)}
        renderClip={(clip, track) =>
          track.kind === 'audio' ? (
            <div className="absolute inset-x-0 top-4 bottom-0.5">
              <Waveform peaks={peaks} rate={40} from={clip.in} to={clip.out} gain={clip.volume ?? 1} tone="success" />
            </div>
          ) : clip.media in frames ? (
            <Filmstrip frames={frames[clip.media]} from={clip.in} to={clip.out} className="opacity-80" />
          ) : null
        }
      />
    </div>
  )
}
