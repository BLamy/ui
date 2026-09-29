import { useState } from 'react'
import {
  Icon,
  Morph,
  MorphGroup,
  MorphPresence,
  NowPlayingBars,
  Slider,
} from '@brett_lamy/ui'

const art = 'linear-gradient(135deg,#ff7a59 0%,#ff3d7f 45%,#7b3dff 100%)'

// One player, two layouts. Both use <Morph id="player"> (and the artwork and
// title inside use their own ids), so switching layouts springs the same
// element from the bar's frame to the full screen. Drag the full player down to
// fold it back.
export default function MiniPlayer() {
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        position: 'relative',
        height: 560,
        maxWidth: 380,
        margin: '0 auto',
        overflow: 'hidden',
        borderRadius: 22,
        background: 'var(--bl-bg)',
        boxShadow: '0 0 0 1px var(--bl-sep)',
      }}
    >
      <div style={{ padding: 20 }}>
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: -0.4,
            color: 'var(--bl-label)',
          }}
        >
          Listen Now
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            marginTop: 14,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                aspectRatio: '1',
                borderRadius: 12,
                background: 'var(--bl-fill)',
              }}
            />
          ))}
        </div>
      </div>
      <MorphGroup>
        <MorphPresence>
          {open ? (
            <Morph
              key="full"
              id="player"
              radius={22}
              dragToDismiss
              onDismiss={() => setOpen(false)}
              role="dialog"
              aria-label="Now Playing"
              style={{
                position: 'absolute',
                inset: 0,
                zIndex: 2,
                display: 'flex',
                flexDirection: 'column',
                padding: '10px 26px 26px',
                overflow: 'hidden',
                color: '#fff',
                background: 'linear-gradient(180deg,#5a2748,#1e1030)',
              }}
            >
              <button
                type="button"
                aria-label="Close Now Playing"
                onClick={() => setOpen(false)}
                style={{
                  alignSelf: 'center',
                  width: 56,
                  height: 20,
                  border: 0,
                  padding: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  marginBottom: 14,
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: 40,
                    height: 5,
                    margin: '0 auto',
                    borderRadius: 3,
                    background: 'rgba(255,255,255,.4)',
                  }}
                />
              </button>
              <Morph
                id="art"
                radius={14}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  background: art,
                  boxShadow: '0 18px 50px rgba(0,0,0,.35)',
                }}
              />
              <Morph id="title" layout="position" style={{ marginTop: 24 }}>
                <div style={{ fontSize: 20, fontWeight: 600 }}>Golden Hour</div>
                <div style={{ fontSize: 16, color: 'rgba(255,255,255,.6)' }}>
                  The Weekend Ensemble
                </div>
              </Morph>
              <Morph
                id="controls"
                fade
                style={{ marginTop: 18, display: 'grid', gap: 16 }}
              >
                <Slider
                  aria-label="Position"
                  tone="onDark"
                  size="sm"
                  defaultValue={32}
                />
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    gap: 44,
                  }}
                >
                  <Icon name="backward" size={32} />
                  <Icon name="pause" size={40} />
                  <Icon name="forward" size={32} />
                </div>
              </Morph>
            </Morph>
          ) : (
            <Morph
              key="mini"
              id="player"
              radius={14}
              as="button"
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open Now Playing"
              style={{
                position: 'absolute',
                left: 10,
                right: 10,
                bottom: 10,
                zIndex: 2,
                height: 64,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '0 16px 0 8px',
                border: 0,
                font: 'inherit',
                textAlign: 'left',
                cursor: 'pointer',
                overflow: 'hidden',
                color: 'var(--bl-label)',
                background: 'var(--bl-bar)',
                backdropFilter: 'blur(24px) saturate(1.8)',
                boxShadow:
                  '0 6px 24px rgba(0,0,0,.16), 0 0 0 .5px var(--bl-sep)',
              }}
            >
              <Morph
                id="art"
                radius={8}
                style={{
                  width: 48,
                  height: 48,
                  flexShrink: 0,
                  background: art,
                }}
              />
              <Morph
                id="title"
                layout="position"
                style={{ flex: 1, minWidth: 0 }}
              >
                <div style={{ fontSize: 15, fontWeight: 500 }}>Golden Hour</div>
                <div style={{ fontSize: 13, color: 'var(--bl-label2)' }}>
                  The Weekend Ensemble
                </div>
              </Morph>
              <NowPlayingBars style={{ color: 'var(--bl-tint)' }} />
            </Morph>
          )}
        </MorphPresence>
      </MorphGroup>
    </div>
  )
}
