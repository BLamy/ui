import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { AdaptivePane, type AdaptivePaneMode } from '@/components/ui/adaptive-pane'

const panel: CSSProperties = {
  height: '100%',
  padding: 16,
  boxSizing: 'border-box',
  background: 'var(--card)',
  fontSize: 13.5,
}

export default function PaneModes({
  variant = 'column',
}: {
  variant?: string
}) {
  // column | drawer | cover | hidden — a real shell picks this from its
  // measured width
  const mode = variant as AdaptivePaneMode
  const [open, setOpen] = useState(true)
  const [drawer, setDrawer] = useState(false)
  useEffect(() => {
    setOpen(true)
  }, [mode])
  return (
    <Frame height={340}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <AdaptivePane
          mode={mode}
          open={open}
          onClose={() => setOpen(false)}
          columnWidth={200}
          drawerWidth={240}
          zIndex={20}
          columnStyle={{ borderRight: '1px solid var(--border)' }}
        >
          <div style={panel}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Pane</div>
            <div style={{ color: 'var(--muted-foreground)' }}>
              Same children, mode: {mode}
            </div>
          </div>
        </AdaptivePane>
        <div
          style={{
            flex: 1,
            minWidth: 0,
            padding: 18,
            display: 'flex',
            flexDirection: 'column',
            gap: 14,
          }}
        >
          <div
            style={{ fontSize: 13, color: 'var(--muted-foreground)', lineHeight: 1.5 }}
          >
            A shell picks the mode from its measured width; the pane never
            remounts its children within a mode. Switch modes in the header.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {mode === 'drawer' ? (
              <TintButton label="Open pane" onPress={() => setOpen(true)} />
            ) : null}
            <TintButton
              label="Open right drawer"
              onPress={() => setDrawer(true)}
            />
          </div>
        </div>
        {/* A second pane in drawer mode, from the right edge */}
        <AdaptivePane
          mode="drawer"
          side="right"
          open={drawer}
          onClose={() => setDrawer(false)}
          drawerWidth={240}
          zIndex={40}
        >
          <div style={panel}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Right drawer</div>
            <div style={{ color: 'var(--muted-foreground)' }}>
              Scrim + panel. Tap the scrim to close.
            </div>
          </div>
        </AdaptivePane>
      </div>
    </Frame>
  )
}

/** A rounded, fixed-height stage for the pane to live in. */
function Frame({ height, children }: { height: number; children?: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        height,
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--muted)',
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
}: {
  label: string
  onPress: () => void
}) {
  return (
    <button
      onClick={onPress}
      style={{
        border: 0,
        borderRadius: 10,
        background: 'var(--primary)',
        color: '#fff',
        fontFamily: 'inherit',
        fontWeight: 600,
        fontSize: 13.5,
        padding: '9px 16px',
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  )
}
