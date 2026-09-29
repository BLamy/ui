import type { ReactNode } from 'react'
import {
  Button,
  FloatingSheet,
  ProgressStepper,
  useAppearance,
  type FloatingSheetAppearance,
} from '@brett_lamy/ui'

const steps = [
  { id: 'placed', label: 'Placed' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
]

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
          boxShadow: 'inset 0 0 0 1px var(--border)',
        }}
      >
        <div style={{ padding: 22 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '.08em',
              opacity: 0.6,
            }}
          >
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
            {[
              '#0A84FF',
              '#FF9F0A',
              '#30D158',
              '#BF5AF2',
              '#FF375F',
              '#64D2FF',
            ].map((c) => (
              <div
                key={c}
                style={{
                  height: 64,
                  borderRadius: 14,
                  background: c,
                  opacity: dark ? 0.75 : 0.6,
                }}
              />
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

// Changing appearance (or tone) morphs the same surface — background, border
// and shadow cross on the spring curves; nothing remounts.
export default function AppearanceMorph({
  variant = 'glass',
}: {
  variant?: string
}) {
  const appearance: FloatingSheetAppearance =
    variant === 'sheet' ? 'sheet' : 'glass'
  return (
    <Host
      note={
        'Switch the appearance in the header: the same surface changes ' +
        'material — no remount, no jump.'
      }
    >
      <FloatingSheet
        appearance={appearance}
        peek={150}
        label="Order"
        hideOnScroll={false}
      >
        <FloatingSheet.Body>
          <div style={{ padding: '2px 20px 24px', display: 'grid', gap: 12 }}>
            <h3 style={{ margin: 0, fontSize: 20 }}>Preparing your order</h3>
            <ProgressStepper current={1} labels steps={steps} />
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                style={{
                  height: 56,
                  borderRadius: 14,
                  background: 'rgba(120,120,128,.14)',
                }}
              />
            ))}
          </div>
        </FloatingSheet.Body>
        <FloatingSheet.Foot>
          <div style={{ padding: '8px 16px 16px' }}>
            <Button size="pill">Track order</Button>
          </div>
        </FloatingSheet.Foot>
      </FloatingSheet>
    </Host>
  )
}
