import { useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  AdaptivePane,
  AdaptivePaneClose,
  AdaptivePaneHeader,
  AdaptivePaneTitle,
  adaptivePanePageClass,
} from '@/components/ui/adaptive-pane'
import { Icon } from '@/lib/icon'

const comments = [
  { f: 'Nadia', l: 'Brooks', text: 'Can we tighten the intro? It runs long.', time: '2h' },
  { f: 'Tom', l: 'Reyes', text: 'Agreed. The second paragraph could go.', time: '1h' },
  { f: 'Ellen', l: 'Park', text: 'Love the new headline.', time: '12m' },
]

// A phone-width host: the pane is pushed like a NavigationStack screen. The
// article parallaxes left under a dim (and is inert), the header is the bar
// with a back button, and a swipe from the left edge pops it.
function Article() {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ position: 'relative', height: 520, overflow: 'hidden', background: 'var(--background)' }}>
      {/* the page under the push: `adaptivePanePageClass` makes it parallax */}
      <article className={adaptivePanePageClass} style={{ position: 'absolute', inset: 0, padding: '28px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ flex: 1, margin: 0, fontSize: 22 }}>Launch announcement</h3>
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            <Icon name="message" size={16} /> {comments.length}
          </Button>
        </div>
        <p style={{ lineHeight: 1.6, color: 'var(--muted-foreground)' }}>
          Today we are shipping the new workspace. It is faster, it syncs
          everywhere, and it finally has dark mode.
        </p>
      </article>
      <AdaptivePane
        presentation="push"
        side="end"
        open={open}
        onOpenChange={setOpen}
      >
        <AdaptivePaneHeader>
          <AdaptivePaneTitle>Comments</AdaptivePaneTitle>
          <AdaptivePaneClose backLabel="Article" />
        </AdaptivePaneHeader>
        {comments.map((c) => (
          <div key={c.text} style={{ display: 'flex', gap: 10, padding: '11px 16px', borderBottom: '1px solid var(--border)' }}>
            <Avatar name={`${c.f} ${c.l}`} size={30} />
            <div style={{ fontSize: 14, lineHeight: 1.45 }}>
              <strong>{c.f}</strong>{' '}
              <span style={{ color: 'var(--tertiary-foreground)' }}>{c.time}</span>
              <div>{c.text}</div>
            </div>
          </div>
        ))}
      </AdaptivePane>
    </div>
  )
}

export default function CompactPush() {
  return (
    <Window width={380}>
      <Article />
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
