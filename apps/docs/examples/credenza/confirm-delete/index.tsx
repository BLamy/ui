import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import {
  Credenza,
  CredenzaBackdrop,
  CredenzaClose,
  CredenzaContent,
  CredenzaHeader,
  CredenzaTitle,
  CredenzaView,
} from '@/components/ui/credenza'
import { BLProvider } from '@/lib/theme'
import { Icon } from '@/lib/icon'

const photos = [
  '#FF9F0A',
  '#30B0C7',
  '#5E5CE6',
  '#FF375F',
  '#34C759',
  '#0A84FF',
]

function ConfirmDelete() {
  const [confirming, setConfirming] = useState(false)
  const [left, setLeft] = useState(photos)
  const selected = left.slice(0, 3)
  return (
    <div
      style={{
        position: 'relative',
        height: 380,
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <strong style={{ flex: 1, fontSize: 17 }}>
          Recents · {selected.length} selected
        </strong>
        <Button
          variant="destructive"
          size="sm"
          disabled={!selected.length}
          onClick={() => setConfirming(true)}
        >
          <Icon name="trash" size={17} /> Delete
        </Button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 8,
        }}
      >
        {left.map((c, i) => (
          <div
            key={c}
            style={{
              height: 90,
              borderRadius: 10,
              background: c,
              opacity: i < 3 ? 1 : 0.45,
              outline: i < 3 ? '3px solid var(--primary)' : 'none',
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
      {/* `presentation="dialog"`: a centered card, whatever the container. */}
      <Credenza
        open={confirming}
        onOpenChange={setConfirming}
        presentation="dialog"
      >
        <CredenzaBackdrop />
        <CredenzaContent>
          <CredenzaHeader>
            <CredenzaTitle>{`Delete ${selected.length} photos?`}</CredenzaTitle>
            <CredenzaClose />
          </CredenzaHeader>
          <CredenzaView>
            <div style={{ padding: '2px 16px 16px' }}>
              <p
                style={{
                  margin: '0 0 16px',
                  fontSize: 14.5,
                  lineHeight: 1.45,
                  color: 'var(--muted-foreground)',
                }}
              >
                They move to Recently Deleted and are removed for good after 30
                days.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <CredenzaClose
                  render={<Button variant="secondary" style={{ flex: 1 }} />}
                >
                  Cancel
                </CredenzaClose>
                <CredenzaClose
                  render={<Button variant="destructive" style={{ flex: 1 }} />}
                  action={() =>
                    setLeft((l) => (l.length > 3 ? l.slice(3) : photos))
                  }
                >
                  Delete
                </CredenzaClose>
              </div>
            </div>
          </CredenzaView>
        </CredenzaContent>
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
      {/* Popups render into BLProvider's root: the Credenza and its scrim stay
          inside this window. */}
      <BLProvider>{children}</BLProvider>
    </div>
  )
}

export default function DeletePhotos() {
  return (
    <Window>
      <ConfirmDelete />
    </Window>
  )
}
