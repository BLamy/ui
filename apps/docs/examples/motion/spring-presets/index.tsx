import { useState } from 'react'
import { Button, springCss, type SpringName } from '@brett_lamy/ui'

const PRESETS: { id: SpringName; use: string }[] = [
  { id: 'snappy', use: 'small controls, presses, indicators' },
  { id: 'smooth', use: 'layout, panels, navigation' },
  { id: 'tray', use: 'sheets, trays, height morphs' },
  { id: 'bouncy', use: 'rare, celebratory moments' },
]

// springCss samples each preset's physics into a linear() easing for a CSS transition.
// (framer-motion takes the same presets as `transition={springs.smooth}`.)
export default function Springs() {
  const [on, setOn] = useState(false)
  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 440, margin: '0 auto' }}>
      {PRESETS.map((p) => (
        <div
          key={p.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '64px 1fr',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <code style={{ fontSize: 12.5, fontWeight: 600 }}>{p.id}</code>
          <div
            style={{
              position: 'relative',
              height: 30,
              borderRadius: 15,
              background: 'var(--bl-fill)',
            }}
          >
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: on ? 'calc(100% - 27px)' : 3,
                width: 24,
                height: 24,
                borderRadius: 12,
                background: 'var(--bl-tint)',
                transition: springCss('left', p.id),
              }}
            />
          </div>
        </div>
      ))}
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        <Button variant="secondary" onPress={() => setOn((v) => !v)}>
          {on ? 'Back' : 'Go'}
        </Button>
      </div>
      <div
        style={{
          fontSize: 12.5,
          color: 'var(--bl-label2)',
          textAlign: 'center',
          lineHeight: 1.5,
        }}
      >
        Press repeatedly mid-flight — springs retarget from wherever they are.
      </div>
    </div>
  )
}
