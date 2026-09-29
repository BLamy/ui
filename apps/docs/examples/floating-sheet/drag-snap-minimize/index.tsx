import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Button,
  FloatingSheet,
  useAppearance,
  useFloatingSheet,
} from '@brett_lamy/ui'

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
          boxShadow: 'inset 0 0 0 1px var(--bl-sep)',
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

/** Reads the sheet's live state from inside it. */
function Readout() {
  const { open, progress, minimized, peek } = useFloatingSheet()
  const row = (k: string, v: string) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        padding: '7px 0',
        borderBottom: '1px solid rgba(128,128,128,.18)',
      }}
    >
      <span style={{ opacity: 0.7 }}>{k}</span>
      <strong style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</strong>
    </div>
  )
  return (
    <div style={{ padding: '2px 20px 20px', fontSize: 13.5 }}>
      <div style={{ fontSize: 17, fontWeight: 700, margin: '2px 0 8px' }}>
        useFloatingSheet()
      </div>
      {row('open', String(open))}
      {row('progress', Math.round(progress * 100) + '%')}
      {row('peek', peek + 'px')}
      {row('minimized', String(minimized))}
    </div>
  )
}

function Actions() {
  const { open, setOpen, setMinimized } = useFloatingSheet()
  const minimize = () => {
    setOpen(false)
    setMinimized(true)
  }
  return (
    <div style={{ display: 'flex', gap: 8, padding: '8px 16px 16px' }}>
      <Button className="flex-1" onPress={() => setOpen(!open)}>
        {open ? 'Close' : 'Open'}
      </Button>
      <Button className="flex-1" variant="secondary" onPress={minimize}>
        Minimize
      </Button>
    </div>
  )
}

export default function DragSnapMinimize() {
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<string[]>([])
  const onOpenChange = (next: boolean) => {
    setOpen(next)
    setLog((l) => [...l.slice(-2), `onOpenChange(${next})`])
  }
  return (
    <Host
      note={
        'Drag the cap: it tracks the pointer, and on release its velocity ' +
        'carries it — a flick opens or closes it, a slow drag settles at ' +
        'the nearest stop. Drag below the resting height to fold into the ' +
        'FAB. Tap the cap to toggle; Escape or the scrim closes. Last ' +
        'events: ' +
        (log.length ? log.join(', ') : 'none yet')
      }
    >
      <FloatingSheet
        open={open}
        onOpenChange={onOpenChange}
        peek={150}
        label="Status"
        hideOnScroll={false}
      >
        <FloatingSheet.Body>
          <Readout />
        </FloatingSheet.Body>
        <FloatingSheet.Foot>
          <Actions />
        </FloatingSheet.Foot>
      </FloatingSheet>
    </Host>
  )
}
