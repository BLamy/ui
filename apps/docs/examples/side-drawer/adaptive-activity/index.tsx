import { useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { SideDrawer, sideDrawerPageClass } from '@/components/ui/side-drawer'
import { useContainerWidth } from '@/lib/container'

function Activity() {
  return (
    <div style={{ padding: '4px 0' }}>
      {[
        'Called · 4 min',
        'Shared “Q3 plan”',
        'Sent 3 messages',
        'Joined the team',
      ].map((a) => (
        <div
          key={a}
          style={{
            padding: '11px 16px',
            fontSize: 14,
            borderBottom: '1px solid var(--border)',
          }}
        >
          {a}
        </div>
      ))}
    </div>
  )
}

function AdaptiveActivity() {
  const [ref, width] = useContainerWidth()
  const [open, setOpen] = useState(true)
  // One SideDrawer, three presentations: docked when the host is wide, and
  // below that `auto`, an overlay that becomes a pushed page under 440px.
  const presentation = width >= 640 ? 'fixed' : 'auto'
  const shown = width >= 640 ? 'fixed' : width >= 440 ? 'overlay' : 'push'
  return (
    // Measure one stable host; only what is inside it changes with the width.
    <div
      ref={ref}
      style={{
        position: 'relative',
        display: 'flex',
        height: 340,
        overflow: 'hidden',
        background: 'var(--background)',
      }}
    >
      <main className={sideDrawerPageClass} style={{ flex: 1, minWidth: 0 }}>
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Avatar
            c={{ f: 'Maya', l: 'Lindqvist' }}
            size={64}
            style={{ margin: '0 auto' }}
          />
          <div style={{ fontSize: 20, fontWeight: 700, margin: '10px 0 14px' }}>
            Maya Lindqvist
          </div>
          <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>
            {open ? 'Hide' : 'Show'} activity
          </Button>
          <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--muted-foreground)' }}>
            Presentation: {shown}
          </div>
        </div>
      </main>
      <SideDrawer
        presentation={presentation}
        breakpoint={440}
        open={open}
        onOpenChange={setOpen}
        title="Activity"
        backLabel="Profile"
        width={260}
      >
        <Activity />
      </SideDrawer>
    </div>
  )
}

// The host width each variant previews; wide fills the card.
const widths: Record<string, number | undefined> = {
  wide: undefined,
  tablet: 560,
  phone: 380,
}

export default function OneContentThreePresentations({
  variant = 'wide',
}: {
  variant?: string
}) {
  return (
    <Window width={widths[variant]}>
      {/* remount per width so the drawer starts open each time */}
      <AdaptiveActivity key={variant} />
    </Window>
  )
}

/**
 * A rounded window with the page background; `width` caps it (phone-sized
 * examples), centered.
 */
function Window({ width, children }: { width?: number; children?: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
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
