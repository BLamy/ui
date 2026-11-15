import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ToastRegion, createHud, type ToastHud } from '@/components/ui/toast'
import { BLProvider } from '@/lib/theme'

const fields = [
  { label: 'User Name', value: 'amelia@example.com' },
  { label: 'Password', value: 'tR7#pL9!vQ2m' },
  { label: 'Code', value: '482 913' },
]

function Fields({ hud }: { hud: ToastHud }) {
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
            onClick={() => {
              void navigator.clipboard?.writeText(f.value).catch(() => {})
              // Copying again while the pill is up replaces what it says:
              // the label morphs.
              hud(`${f.label} Copied`, { type: 'success' })
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
  // A HUD of its own. Its region renders into the BLProvider around it, so
  // the demo's pill stays in the demo.
  const [hud] = useState(() => createHud())
  return (
    <div style={{ height: 300, overflow: 'hidden', borderRadius: 14 }}>
      <BLProvider className="bg-background">
        <div style={{ height: '100%', display: 'grid', placeItems: 'center' }}>
          <Fields hud={hud} />
        </div>
        <ToastRegion variant="hud" toaster={hud.toaster} offset={18} />
      </BLProvider>
    </div>
  )
}
