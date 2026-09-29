import { useState, type ReactNode } from 'react'
import {
  Avatar,
  Button,
  Credenza,
  Haptics,
  Icon,
  ListRow,
  QRSvg,
} from '@brett_lamy/ui'

const recipients = [
  { f: 'Maya', l: 'Lindqvist' },
  { f: 'Jonas', l: 'Ito' },
  { f: 'Priya', l: 'Raman' },
  { f: 'Leo', l: 'Okafor' },
]

function ShareSheet() {
  const [view, setView] = useState<'share' | 'qr' | null>('share')
  const [copied, setCopied] = useState(false)
  return (
    <div
      style={{
        position: 'relative',
        height: 480,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <Button
        variant="secondary"
        onPress={() => {
          setCopied(false)
          setView('share')
        }}
      >
        <Icon name="share" size={18} /> Share album
      </Button>
      <Credenza
        compact
        open={view !== null}
        view={view ?? 'share'}
        title={view === 'qr' ? 'Scan to open' : 'Summer 2026'}
        canBack={view === 'qr'}
        onBack={() => setView('share')}
        onClose={() => setView(null)}
      >
        {view === 'qr' ? (
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              padding: '10px 0 26px',
            }}
          >
            <QRSvg seed="https://example.com/albums/summer-2026" size={168} />
          </div>
        ) : (
          <div style={{ padding: '4px 8px 10px' }}>
            <div
              style={{
                display: 'flex',
                gap: 14,
                padding: '6px 10px 14px',
                overflowX: 'auto',
              }}
            >
              {recipients.map((p) => (
                <button
                  key={p.f}
                  type="button"
                  onClick={() => setView(null)}
                  style={{
                    border: 0,
                    background: 'none',
                    padding: 0,
                    font: 'inherit',
                    color: 'inherit',
                    cursor: 'pointer',
                    textAlign: 'center',
                  }}
                >
                  <Avatar c={p} size={52} />
                  <div style={{ fontSize: 11.5, marginTop: 5 }}>{p.f}</div>
                </button>
              ))}
            </div>
            <ListRow
              leading={<Icon name="link" size={20} />}
              title={copied ? 'Copied' : 'Copy Link'}
              onPress={() => {
                Haptics.notification('success')
                setCopied(true)
              }}
            />
            <ListRow
              leading={<Icon name="layers" size={20} />}
              title="Show QR Code"
              accessory="chevron"
              onPress={() => setView('qr')}
            />
            <ListRow
              leading={<Icon name="mail" size={20} />}
              title="Email"
              divider={false}
              onPress={() => setView(null)}
            />
          </div>
        )}
      </Credenza>
    </div>
  )
}

// A rounded, hairline-bordered window the example sits in; `width` caps it,
// centered.
function Window({
  width,
  bg = 'var(--background)',
  children,
}: {
  width?: number
  bg?: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: bg,
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function ShareAlbum() {
  return (
    <Window width={430} bg="var(--muted)">
      <ShareSheet />
    </Window>
  )
}
