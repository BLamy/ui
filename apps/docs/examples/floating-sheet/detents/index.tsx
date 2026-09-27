import type { ReactNode } from 'react'
import { FloatingSheet, useAppearance, useFloatingSheet } from '@brett_lamy/ui'

/** A 430×560 host with colour for the glass to blur; follows the appearance. */
function Host({ children, note }: { children?: ReactNode; note: string }) {
  const dark = useAppearance() === 'dark'
  return (
    <div style={{ maxWidth: 430, margin: '0 auto' }}>
      <div
        style={{
          position: 'relative',
          height: 560,
          borderRadius: 12,
          overflow: 'hidden',
          fontFamily: 'var(--bl-font)',
          background: dark
            ? 'radial-gradient(circle at 70% 18%, #2b2f4a, #0f1017 62%)'
            : 'radial-gradient(circle at 70% 18%, #fff4e6, #e8ecf3 62%)',
          color: dark ? '#f5f5f7' : '#1c1c1e',
          boxShadow: 'inset 0 0 0 1px var(--bl-sep)',
        }}
      >
        <div style={{ padding: 22 }}>
          <div style={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.08em', opacity: 0.6 }}>
            HOST CONTENT
          </div>
          <p
            style={{
              margin: '8px 0 0',
              maxWidth: 340,
              lineHeight: 1.5,
              opacity: 0.8,
              fontSize: 14,
            }}
          >
            {note}
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 10,
              marginTop: 18,
            }}
          >
            {['#0A84FF', '#FF9F0A', '#30D158', '#BF5AF2', '#FF375F', '#64D2FF'].map((c) => (
              <div
                key={c}
                style={{ height: 64, borderRadius: 14, background: c, opacity: dark ? 0.75 : 0.6 }}
              />
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function DetentReadout() {
  const { open, progress } = useFloatingSheet()
  return (
    <div style={{ fontSize: 12.5, opacity: 0.7, fontVariantNumeric: 'tabular-nums' }}>
      {open ? 'Full' : progress > 0.05 ? 'Half detent' : 'Resting'} · {Math.round(progress * 100)}%
    </div>
  )
}

// A half-height stop between resting and full. Release is velocity-aware: a flick
// goes to the next stop in its direction; a slow drag settles at the nearest one.
export default function Detents() {
  return (
    <Host note="Drag the cap slowly and let go — it settles at the nearest of resting, half and full. Flick it and it goes to the next stop the way you threw it, keeping your speed.">
      <FloatingSheet
        peek={110}
        detents={[0.5]}
        appearance="sheet"
        gutter={12}
        radius={24}
        label="Places"
        hideOnScroll={false}
      >
        <FloatingSheet.Body>
          <div style={{ padding: '2px 18px 24px', display: 'grid', gap: 10 }}>
            <div
              style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}
            >
              <h3 style={{ margin: 0, fontSize: 19 }}>Coffee nearby</h3>
              <DetentReadout />
            </div>
            {Array.from({ length: 7 }, (_, i) => (
              <div
                key={i}
                style={{ height: 56, borderRadius: 14, background: 'rgba(120,120,128,.14)' }}
              />
            ))}
          </div>
        </FloatingSheet.Body>
      </FloatingSheet>
    </Host>
  )
}
