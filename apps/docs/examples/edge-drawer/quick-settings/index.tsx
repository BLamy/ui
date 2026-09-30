import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { EdgeDrawer } from '@/components/ui/edge-drawer'
import { Icon } from '@/lib/icon'

function QuickSettings() {
  const [open, setOpen] = useState(true)
  const [wifi, setWifi] = useState(true)
  const [focus, setFocus] = useState(false)
  const tile = (
    label: string,
    icon: string,
    on: boolean,
    toggle: () => void,
  ) => (
    <button
      type="button"
      onClick={toggle}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 16,
        border: 0,
        cursor: 'pointer',
        font: 'inherit',
        fontWeight: 600,
        textAlign: 'left',
        background: on ? 'var(--primary)' : 'var(--secondary)',
        color: on ? '#fff' : 'var(--foreground)',
      }}
    >
      <Icon name={icon} size={20} /> {label}
    </button>
  )
  return (
    <div
      style={{
        position: 'relative',
        height: 360,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #5E5CE6, #0A84FF 45%, #30B0C7)',
      }}
    >
      <div style={{ padding: 20 }}>
        <Button
          style={{ background: 'rgba(255,255,255,.92)', color: '#1C1C1E' }}
          onPress={() => setOpen(true)}
        >
          Quick settings
        </Button>
      </div>
      {/* No dimming and no panel shadow: the card inside floats with its
          own */}
      <EdgeDrawer
        side="right"
        open={open}
        onClose={() => setOpen(false)}
        width={284}
        scrim="transparent"
        shadow="none"
      >
        <div
          style={{
            position: 'absolute',
            inset: 12,
            padding: 16,
            borderRadius: 24,
            display: 'grid',
            gap: 10,
            alignContent: 'start',
            background: 'color-mix(in srgb, var(--card) 72%, transparent)',
            backdropFilter: 'blur(24px) saturate(1.6)',
            boxShadow: open ? '0 20px 60px rgba(0,0,0,.25)' : 'none',
          }}
        >
          <strong style={{ fontSize: 17, marginBottom: 4 }}>
            Quick settings
          </strong>
          {tile('Wi-Fi', 'wifi', wifi, () => setWifi(!wifi))}
          {tile('Focus', 'moon', focus, () => setFocus(!focus))}
        </div>
      </EdgeDrawer>
    </div>
  )
}

/** The rounded, hairline-bordered window the example sits in. */
function Window({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--background)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function QuickSettingsExample() {
  return (
    <Window>
      <QuickSettings />
    </Window>
  )
}
