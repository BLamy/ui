import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { Haptics, SideDrawer } from '@brett_lamy/ui'

const rows = [
  'Outgoing call · 2 min',
  'iMessage · yesterday',
  'FaceTime · Mon',
  'Mail · Re: schedule',
]

export default function ActivityDrawer({
  variant = 'overlay',
}: {
  variant?: string
}) {
  const mode = variant === 'fixed' ? 'fixed' : 'overlay'
  // "fixed" starts docked open; "overlay" waits for the button
  const [open, setOpen] = useState(mode === 'fixed')
  useEffect(() => {
    setOpen(mode === 'fixed')
  }, [mode])
  return (
    <Frame height={330} bg="var(--bl-bg)">
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            display: 'grid',
            placeItems: 'center',
            textAlign: 'center',
            padding: 20,
          }}
        >
          <div>
            <div style={{ fontWeight: 650, fontSize: 15.5 }}>Detail view</div>
            {mode === 'overlay' ? (
              <TintButton
                label="Show Activity"
                onPress={() => {
                  Haptics.impact('light')
                  setOpen(true)
                }}
                style={{ marginTop: 12, fontSize: 13, padding: '8px 14px' }}
              />
            ) : (
              <div
                style={{
                  fontSize: 12.5,
                  color: 'var(--bl-label2)',
                  marginTop: 6,
                  lineHeight: 1.5,
                }}
              >
                Docked column — no scrim,
                <br />
                part of the layout.
              </div>
            )}
          </div>
        </div>
        {/* overlay slides over the detail with a scrim; fixed docks it as a
            layout column */}
        <SideDrawer
          mode={mode}
          open={open}
          onClose={() => setOpen(false)}
          title="Activity"
          width={230}
        >
          {rows.map((t) => (
            <div
              key={t}
              style={{
                padding: '11px 16px',
                fontSize: 13,
                borderBottom: '1px solid var(--bl-sep)',
                color: 'var(--bl-label2)',
              }}
            >
              {t}
            </div>
          ))}
        </SideDrawer>
      </div>
    </Frame>
  )
}

/** A rounded, fixed-height stage for the drawer to live in. */
function Frame({
  height,
  bg,
  children,
}: {
  height: number
  bg: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        background: bg,
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)',
      }}
    >
      {children}
    </div>
  )
}

function TintButton({
  label,
  onPress,
  style,
}: {
  label: string
  onPress: () => void
  style?: CSSProperties
}) {
  return (
    <button
      onClick={onPress}
      style={{
        border: 0,
        borderRadius: 10,
        background: 'var(--bl-tint, #0A84FF)',
        color: '#fff',
        fontFamily: 'inherit',
        fontWeight: 600,
        fontSize: 13.5,
        padding: '9px 16px',
        cursor: 'pointer',
        ...style,
      }}
    >
      {label}
    </button>
  )
}
