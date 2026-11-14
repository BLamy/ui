import { useState, type ReactNode } from 'react'
import {
  AdaptivePane,
  AdaptivePaneClose,
  AdaptivePaneHeader,
  AdaptivePaneTitle,
  adaptivePanePageClass,
} from '@/components/ui/adaptive-pane'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { SizeClassProvider, useSizeClass } from '@/lib/container'

const activity = ['Called · 4 min', 'Shared “Q3 plan”', 'Sent 3 messages', 'Joined the team']

function Profile() {
  // The host measures its own size class and makes it the scope of what it
  // renders; the pane's `auto` reads that scope: regular → column,
  // medium → drawer, compact → push (an `end` pane).
  const [ref, sizeClass] = useSizeClass({ breakpoints: { medium: 440, regular: 640 } })
  const [open, setOpen] = useState(true)
  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        display: 'flex',
        height: 360,
        overflow: 'hidden',
        background: 'var(--background)',
      }}
    >
      <SizeClassProvider value={sizeClass}>
        <main className={adaptivePanePageClass} style={{ flex: 1, minWidth: 0 }}>
          <div style={{ padding: 24, textAlign: 'center' }}>
            <Avatar name="Maya Lindqvist" size={64} style={{ margin: '0 auto' }} />
            <div style={{ fontSize: 20, fontWeight: 700, margin: '10px 0 14px' }}>
              Maya Lindqvist
            </div>
            <Button size="sm" variant="secondary" aria-pressed={open} onClick={() => setOpen(!open)}>
              Activity
            </Button>
            <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--muted-foreground)' }}>
              Size class: {sizeClass}
            </div>
          </div>
        </main>
        <AdaptivePane
          side="end"
          open={open}
          onOpenChange={setOpen}
          columnWidth={260}
          drawerWidth={280}
          className={({ presentation }) => (presentation === 'column' ? 'border-s border-border' : undefined)}
        >
          <AdaptivePaneHeader>
            <AdaptivePaneTitle>Activity</AdaptivePaneTitle>
            <AdaptivePaneClose backLabel="Profile" />
          </AdaptivePaneHeader>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
            {activity.map((a) => (
              <div key={a} style={{ padding: '11px 16px', fontSize: 14, borderBottom: '1px solid var(--border)' }}>
                {a}
              </div>
            ))}
          </div>
        </AdaptivePane>
      </SizeClassProvider>
    </div>
  )
}

// The host width each variant previews; wide fills the card.
const widths: Record<string, number | undefined> = {
  wide: undefined,
  tablet: 560,
  phone: 380,
}

export default function AutoPresentation({ variant = 'wide' }: { variant?: string }) {
  return (
    <Window width={widths[variant]}>
      {/* remount per width so the pane starts open each time */}
      <Profile key={variant} />
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
