import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import {
  AdaptivePane,
  AdaptivePaneClose,
  AdaptivePaneHeader,
  AdaptivePaneTitle,
  type AdaptivePanePresentation,
} from '@/components/ui/adaptive-pane'

const panel: CSSProperties = {
  flex: 1,
  padding: '4px 16px 16px',
  boxSizing: 'border-box',
  fontSize: 13.5,
}

export default function PaneModes({
  variant = 'column',
}: {
  variant?: string
}) {
  // column | drawer | push | cover | hidden — a real shell lets `auto` pick
  // it from its size class. `resizable` and `drawer-resizable` add the divider.
  const resizable = variant === 'resizable' || variant === 'drawer-resizable'
  const mode: AdaptivePanePresentation =
    variant === 'resizable' ? 'column' : variant === 'drawer-resizable' ? 'drawer' : (variant as AdaptivePanePresentation)
  const [open, setOpen] = useState(true)
  const [drawer, setDrawer] = useState(false)
  useEffect(() => {
    setOpen(true)
  }, [mode])
  return (
    <Frame height={340}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
        <AdaptivePane
          presentation={mode}
          open={open}
          onOpenChange={setOpen}
          swipeToOpen
          resizable={resizable}
          columnWidth={200}
          drawerWidth={240}
          zIndex={20}
          className="border-r border-border bg-card"
        >
          <AdaptivePaneHeader>
            <AdaptivePaneTitle>Pane</AdaptivePaneTitle>
            <AdaptivePaneClose backLabel="Page" />
          </AdaptivePaneHeader>
          <div style={panel}>
            <div style={{ color: 'var(--muted-foreground)' }}>
              Same children, presentation: {mode}
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
            A shell picks the presentation from its measured width; the pane
            never remounts its children. Switch presentations in the header.
            A drawer drags shut by its panel and drags open from the left edge;
            the resizable variants have a divider to drag.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!open ? (
              <TintButton label="Open pane" onClick={() => setOpen(true)} />
            ) : null}
            <TintButton
              label="Open right drawer"
              onClick={() => setDrawer(true)}
            />
          </div>
        </div>
        {/* A second pane presented as a drawer, from the end edge (the right in left-to-right text) */}
        <AdaptivePane
          presentation="drawer"
          side="end"
          open={drawer}
          onOpenChange={setDrawer}
          drawerWidth={240}
          zIndex={40}
        >
          <AdaptivePaneHeader>
            <AdaptivePaneTitle>Right drawer</AdaptivePaneTitle>
            <AdaptivePaneClose />
          </AdaptivePaneHeader>
          <div style={panel}>
            <div style={{ color: 'var(--muted-foreground)' }}>
              Scrim + panel. Tap the scrim, press Escape or swipe right to close.
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
  onClick,
}: {
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
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
