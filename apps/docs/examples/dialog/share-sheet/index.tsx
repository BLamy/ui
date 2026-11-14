import { useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,  DialogBack,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogView,
} from '@/components/ui/dialog'
import { ListRow } from '@/components/ui/list'
import { QRCode } from '@/components/ui/qr-code'
import { Icon } from '@/lib/icon'
import { BLProvider } from '@/lib/theme'

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
        onClick={() => {
          setCopied(false)
          setView('share')
        }}
      >
        <Icon name="share" size={18} /> Share album
      </Button>
      <Dialog
        presentation="sheet"
        open={view !== null}
        onOpenChange={(open) => {
          if (!open) setView(null)
        }}
        view={view ?? 'share'}
      >
        <DialogBackdrop />
        <DialogContent variant="tray">
          <DialogHeader variant="bar">
            <DialogBack
              hidden={view !== 'qr'}
              onClick={() => setView('share')}
            />
            <DialogTitle>
              {view === 'qr' ? 'Scan to open' : 'Summer 2026'}
            </DialogTitle>
            <DialogClose />
          </DialogHeader>
          <DialogView>
            {view === 'qr' ? (
              <div
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  padding: '10px 0 26px',
                }}
              >
                <QRCode
                  value="https://example.com/albums/summer-2026"
                  size={168}
                />
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
                      <Avatar name={`${p.f} ${p.l}`} size={52} />
                      <div style={{ fontSize: 11.5, marginTop: 5 }}>{p.f}</div>
                    </button>
                  ))}
                </div>
                <ListRow
                  icon={<Icon name="link" size={20} />}
                  title={copied ? 'Copied' : 'Copy Link'}
                  onClick={() => {
                    setCopied(true)
                  }}
                />
                <ListRow
                  icon={<Icon name="layers" size={20} />}
                  title="Show QR Code"
                  accessory="chevron"
                  onClick={() => setView('qr')}
                />
                <ListRow
                  icon={<Icon name="mail" size={20} />}
                  title="Email"
                  divider={false}
                  onClick={() => setView(null)}
                />
              </div>
            )}
          </DialogView>
        </DialogContent>
      </Dialog>
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
      {/* Popups render into BLProvider's root: the dialog and its scrim stay
          inside this window. */}
      <BLProvider>{children}</BLProvider>
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
