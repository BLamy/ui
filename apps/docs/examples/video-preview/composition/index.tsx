import { useEffect, useState } from 'react'
import { PlaybackControls, VideoPreview } from '@/components/ui/video-preview'
import { VideoTimeline } from '@/components/ui/video-timeline'
import { usePlaybackClock } from '@/lib/playback'
import { layoutTrack, timelineDuration, type Timeline } from '@/lib/video-timeline'

// A preview and a timeline on one clock. The preview plays the edit live (no
// render): each clip near the playhead is an element in its frame, faded,
// dissolved and coloured by CSS. These clips are stills and a title so the
// example needs no files; video and audio clips play their media the same way.

const still = (from: string, to: string, label: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><defs><linearGradient id="g" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="1280" height="720" fill="url(#g)"/><text x="640" y="640" font-size="84" font-weight="700" font-family="sans-serif" fill="white" fill-opacity=".85" text-anchor="middle">${label}</text></svg>`,
  )}`

const MEDIA = {
  dawn: { url: still('hsl(28 90% 60%)', 'hsl(330 70% 45%)', 'Dawn'), kind: 'image' },
  noon: { url: still('hsl(200 90% 55%)', 'hsl(230 70% 40%)', 'Noon'), kind: 'image' },
  dusk: { url: still('hsl(270 60% 45%)', 'hsl(220 60% 15%)', 'Dusk'), kind: 'image' },
  inset: { url: still('hsl(150 60% 45%)', 'hsl(170 70% 25%)', 'PiP'), kind: 'image' },
} as const

const TIMELINE: Timeline = {
  tracks: [
    {
      id: 'over', kind: 'video', name: 'Over',
      clips: [
        { id: 'title', media: 'title', label: 'Title', start: 0.4, in: 0, out: 2.6, fadeIn: 0.4, fadeOut: 0.4, data: { text: 'A day in three stills' } },
        { id: 'pip', media: 'inset', start: 3.6, in: 0, out: 3, fadeIn: 0.3, fadeOut: 0.3, frame: { x: 0.62, y: 0.06, width: 0.32, height: 0.32 } },
      ],
    },
    layoutTrack({
      id: 'main', kind: 'video', name: 'Main', magnetic: true,
      clips: [
        { id: 'a', media: 'dawn', start: 0, in: 0, out: 3.5, fadeIn: 0.6 },
        { id: 'b', media: 'noon', start: 0, in: 0, out: 3.5, transition: 1, look: 'vivid' },
        { id: 'c', media: 'dusk', start: 0, in: 0, out: 3.5, transition: 1, look: 'vintage', fadeOut: 0.8 },
      ],
    }),
  ],
}

export default function Composition() {
  const clock = usePlaybackClock()
  const [selection, setSelection] = useState<string[]>([])
  useEffect(() => {
    clock.setDuration(timelineDuration(TIMELINE))
    clock.seek(1.2)
  }, [clock])
  return (
    <div className="flex h-[520px] w-full flex-col bg-muted">
      <VideoPreview
        className="min-h-0 flex-1 p-3"
        timeline={TIMELINE}
        media={MEDIA}
        clock={clock}
        format={{ width: 1280, height: 720 }}
        renderClip={(clip) =>
          clip.media === 'title' ? (
            // Drawn in the frame's own units, so it scales with the preview.
            <svg viewBox="0 0 1280 720" className="size-full">
              <text x="640" y="380" fontSize="72" fontWeight="800" fill="white" textAnchor="middle" style={{ filter: 'drop-shadow(0 4px 12px black)' }}>
                {String(clip.data?.text ?? '')}
              </text>
            </svg>
          ) : undefined
        }
      />
      <div className="flex justify-center border-y border-border bg-background py-1">
        <PlaybackControls clock={clock} />
      </div>
      <VideoTimeline
        className="h-40 shrink-0"
        timeline={TIMELINE}
        clock={clock}
        media={{ dawn: { duration: Infinity, kind: 'image', name: 'Dawn' }, noon: { duration: Infinity, kind: 'image', name: 'Noon' },
          dusk: { duration: Infinity, kind: 'image', name: 'Dusk' }, inset: { duration: Infinity, kind: 'image', name: 'Inset' },
          title: { duration: Infinity, kind: 'image', name: 'Title' } }}
        selection={selection}
        onSelectionChange={setSelection}
        defaultZoom={64}
        trackHeight={(t) => (t.magnetic ? 48 : 36)}
      />
    </div>
  )
}
