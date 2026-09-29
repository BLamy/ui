import { useEffect, useRef, useState, type ReactNode } from 'react'
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
  { id: 'picked', label: 'Picked up' },
]

interface Preset {
  appearance: FloatingSheetAppearance
  gutter: number
  radius: number
  peek: number
  minimizable: boolean
  foot: boolean
  defaultOpen?: boolean
  note: string
}

const presets: Record<string, Preset> = {
  glass: {
    appearance: 'glass',
    gutter: 20,
    radius: 28,
    peek: 0,
    minimizable: true,
    foot: true,
    note:
      'Rests on its foot. Drag the cap up to grow it, or down to fold it ' +
      'into a FAB.',
  },
  peeking: {
    appearance: 'glass',
    gutter: 20,
    radius: 28,
    peek: 190,
    minimizable: true,
    foot: true,
    note:
      'peek keeps the top of the body visible above the foot ' +
      'while resting.',
  },
  card: {
    appearance: 'sheet',
    gutter: 14,
    radius: 26,
    peek: 150,
    minimizable: true,
    foot: true,
    note: 'An opaque card that floats inside a gutter.',
  },
  docked: {
    appearance: 'sheet',
    gutter: 0,
    radius: 20,
    peek: 250,
    minimizable: false,
    foot: false,
    note:
      'gutter={0} docks it edge to edge like a system sheet; it cannot be ' +
      'folded away.',
  },
  open: {
    appearance: 'glass',
    gutter: 20,
    radius: 28,
    peek: 0,
    minimizable: true,
    foot: true,
    defaultOpen: true,
    note:
      'Fully grown: the cap meets the top edge and the host dims ' +
      'behind it.',
  },
}

/**
 * Lays a fixed-size composition out at its design width, scaled down (never up)
 * to fit, centered.
 */
function Scaled({
  width,
  height,
  children,
}: {
  width: number
  height: number
  children: ReactNode
}) {
  const host = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const resize = () => setScale(Math.min(1, el.clientWidth / width))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])
  return (
    <div
      ref={host}
      style={{
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        height: height * scale,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          width,
          height,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * A host with enough colour and texture that the glass visibly blurs it;
 * follows the appearance.
 */
function Host({ note, children }: { note: string; children?: ReactNode }) {
  const dark = useAppearance() === 'dark'
  return (
    <Scaled width={430} height={560}>
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          borderRadius: 12,
          overflow: 'hidden',
          fontFamily: 'var(--bl-font)',
          background: dark
            ? 'radial-gradient(circle at 30% 20%, #2b2f4a, #0f1017 62%)'
            : 'radial-gradient(circle at 30% 20%, #fff4e6, #e8ecf3 62%)',
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
          <h2 style={{ margin: '8px 0 10px', fontSize: 24 }}>
            Anything positioned
          </h2>
          <p
            style={{
              margin: 0,
              maxWidth: 330,
              lineHeight: 1.5,
              opacity: 0.78,
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
              marginTop: 20,
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
                  height: 70,
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
    </Scaled>
  )
}

export default function Appearances({
  variant = 'glass',
}: {
  variant?: string
}) {
  const p = presets[variant] ?? presets.glass
  return (
    <Host note={p.note}>
      {/* key: each preset starts fresh from its own resting state */}
      <FloatingSheet
        key={variant}
        appearance={p.appearance}
        gutter={p.gutter}
        radius={p.radius}
        peek={p.peek}
        minimizable={p.minimizable}
        defaultOpen={p.defaultOpen}
        label="Order"
        hideOnScroll={false}
      >
        <FloatingSheet.Body>
          <div
            style={{
              padding: '2px 20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 21 }}>Preparing your order</h3>
            <ProgressStepper current={1} labels steps={steps} />
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                style={{
                  height: 64,
                  borderRadius: 14,
                  background: 'rgba(120,120,128,.14)',
                }}
              />
            ))}
          </div>
        </FloatingSheet.Body>
        {p.foot ? (
          <FloatingSheet.Foot>
            <div style={{ padding: '8px 16px 16px' }}>
              <Button size="pill">Continue</Button>
            </div>
          </FloatingSheet.Foot>
        ) : null}
      </FloatingSheet>
    </Host>
  )
}
