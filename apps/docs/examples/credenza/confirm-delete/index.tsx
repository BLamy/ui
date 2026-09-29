import { useState, type ReactNode } from 'react'
import { Button, Credenza, Haptics, Icon } from '@brett_lamy/ui'

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
          isDisabled={!selected.length}
          onPress={() => setConfirming(true)}
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
              outline: i < 3 ? '3px solid var(--bl-tint)' : 'none',
              outlineOffset: 2,
            }}
          />
        ))}
      </div>
      {/* Without compact it is a centered dialog. */}
      <Credenza
        open={confirming}
        title={`Delete ${selected.length} photos?`}
        onClose={() => setConfirming(false)}
      >
        <div style={{ padding: '2px 16px 16px' }}>
          <p
            style={{
              margin: '0 0 16px',
              fontSize: 14.5,
              lineHeight: 1.45,
              color: 'var(--bl-label2)',
            }}
          >
            They move to Recently Deleted and are removed for good after 30
            days.
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => setConfirming(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              style={{ flex: 1 }}
              onPress={() => {
                Haptics.notification('warning')
                setLeft((l) => (l.length > 3 ? l.slice(3) : photos))
                setConfirming(false)
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </Credenza>
    </div>
  )
}

// A rounded, hairline-bordered window the example sits in; `width` caps it,
// centered.
function Window({
  width,
  bg = 'var(--bl-bg)',
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
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
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
