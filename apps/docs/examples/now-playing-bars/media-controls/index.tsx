import { useState } from 'react'
import { Icon, NowPlayingBars, Slider } from '@brett_lamy/ui'

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`

// Media controls over dark glass: `tone="onDark"` for translucent white tracks, `size="sm"` for the
// scrubber's small thumb (it grows while you drag).
export default function MediaControls() {
  const [pos, setPos] = useState(78)
  const [volume, setVolume] = useState(60)
  const dur = 221
  return (
    <div
      style={{
        width: 'min(360px, 100%)',
        margin: '0 auto',
        padding: '20px 22px',
        boxSizing: 'border-box',
        borderRadius: 22,
        color: '#fff',
        background: 'radial-gradient(120% 90% at 10% 0%, #7a2e5f, transparent 70%), linear-gradient(180deg, #3b1d4d, #140b1f)',
        display: 'grid',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 8,
            background: 'linear-gradient(135deg,#ff7a59,#ff3d7f 45%,#7b3dff)',
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 600 }}>Golden Hour</div>
          <div style={{ fontSize: 15, color: 'rgba(255,255,255,.6)' }}>The Weekend Ensemble</div>
        </div>
        <NowPlayingBars size={16} />
      </div>
      <div>
        <Slider aria-label="Playback position" tone="onDark" size="sm" minValue={0} maxValue={dur} value={pos} onChange={(v) => setPos(v as number)} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,.55)', fontVariantNumeric: 'tabular-nums' }}>
          <span>{fmt(pos)}</span>
          <span>-{fmt(dur - pos)}</span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(255,255,255,.55)' }}>
        <Icon name="speaker-low" size={16} />
        <Slider aria-label="Volume" tone="onDark" size="sm" value={volume} onChange={(v) => setVolume(v as number)} style={{ flex: 1 }} />
        <Icon name="speaker-high" size={18} />
      </div>
    </div>
  )
}
