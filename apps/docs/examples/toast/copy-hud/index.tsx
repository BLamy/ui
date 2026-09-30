import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Toaster, createToastQueue, useToast } from '@/components/ui/toast'

const fields = [
  { label: 'User Name', value: 'amelia@example.com' },
  { label: 'Password', value: 'tR7#pL9!vQ2m' },
  { label: 'Code', value: '482 913' },
]

function Fields() {
  const toast = useToast()
  return (
    <div style={{ display: 'grid', gap: 8, width: 'min(320px, 100%)' }}>
      {fields.map((f) => (
        <div
          key={f.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 12px 10px 16px',
            borderRadius: 12,
            background: 'var(--card)',
            boxShadow: '0 0 0 1px var(--border)',
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>
              {f.label}
            </div>
            <div style={{ fontSize: 15, color: 'var(--foreground)' }}>
              {f.value}
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onPress={() => {
              void navigator.clipboard?.writeText(f.value).catch(() => {})
              // Copying again while the HUD is up updates it in place: the
              // label morphs.
              toast.hud(`${f.label} Copied`, { tone: 'success' })
            }}
          >
            Copy
          </Button>
        </div>
      ))}
    </div>
  )
}

export default function CopyHud() {
  // A queue of its own, shown inside this box (`inline`), so the demo's HUD
  // stays in the demo.
  const [queue] = useState(() => createToastQueue())
  return (
    <div
      style={{
        position: 'relative',
        height: 300,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        borderRadius: 14,
        background: 'var(--background)',
      }}
    >
      <Toaster queue={queue} placement="bottom" inline offset={18}>
        <Fields />
      </Toaster>
    </div>
  )
}
