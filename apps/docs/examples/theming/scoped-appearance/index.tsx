import { useState } from 'react'
import { BLProvider, Button, Icon, Slider } from '@brett_lamy/ui'

export default function NowPlaying() {
  const [volume, setVolume] = useState(60)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      {/* Nested providers win: these two cards ignore the page's appearance */}
      {[false, true].map((dark) => (
        <BLProvider
          key={String(dark)}
          dark={dark}
          tint="#FF375F"
          style={{ height: 'auto', borderRadius: 18 }}
        >
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'center',
              padding: 16,
              background: 'var(--bl-card)',
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: 'linear-gradient(135deg, #FF375F, #FF9F0A)',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 650 }}>Midnight City</div>
              <div style={{ fontSize: 13, color: 'var(--bl-label2)' }}>
                M83 · {dark ? 'dark' : 'light'}
              </div>
              <Slider
                aria-label="Volume"
                value={volume}
                onChange={setVolume}
                style={{ marginTop: 8 }}
              />
            </div>
            <Button size="icon" aria-label="Like">
              <Icon name="heart" size={18} />
            </Button>
          </div>
        </BLProvider>
      ))}
    </div>
  )
}
