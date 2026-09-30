import { useState } from 'react'
import { NowPlayingBars } from '@/components/ui/now-playing-bars'

const tracks = [
  { title: 'Golden Hour', time: '3:41' },
  { title: 'Night Drive', time: '4:12' },
  { title: 'Paper Planes', time: '2:58' },
  { title: 'Low Tide', time: '5:03' },
]

// Tap a track to play it, tap it again to pause: the bars settle to a still
// skyline.
export default function TrackList() {
  const [current, setCurrent] = useState(1)
  const [playing, setPlaying] = useState(true)
  return (
    <div
      style={{
        width: 'min(360px, 100%)',
        margin: '0 auto',
        borderRadius: 14,
        background: 'var(--card)',
        boxShadow: '0 0 0 1px var(--border)',
        overflow: 'hidden',
      }}
    >
      {tracks.map((t, i) => {
        const on = i === current
        return (
          <button
            key={t.title}
            type="button"
            onClick={() =>
              on ? setPlaying((p) => !p) : (setCurrent(i), setPlaying(true))
            }
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              width: '100%',
              height: 48,
              padding: '0 16px',
              border: 0,
              borderTop: i ? '1px solid var(--border)' : 0,
              background: 'transparent',
              font: 'inherit',
              fontSize: 16,
              textAlign: 'left',
              cursor: 'pointer',
              color: on ? 'var(--primary)' : 'var(--foreground)',
            }}
          >
            <span
              style={{
                width: 18,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--muted-foreground)',
                fontSize: 14,
              }}
            >
              {on ? (
                <NowPlayingBars
                  playing={playing}
                  style={{ color: 'var(--primary)' }}
                  aria-label={playing ? 'Now playing' : 'Paused'}
                />
              ) : (
                i + 1
              )}
            </span>
            <span style={{ flex: 1, fontWeight: on ? 600 : 400 }}>
              {t.title}
            </span>
            <span
              style={{
                fontSize: 14,
                color: 'var(--muted-foreground)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {t.time}
            </span>
          </button>
        )
      })}
    </div>
  )
}
