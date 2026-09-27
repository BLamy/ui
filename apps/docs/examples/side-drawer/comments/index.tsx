import { useState, type ReactNode } from 'react'
import { Avatar, Button, Icon, SideDrawer } from '@brett_lamy/ui'

const comments = [
  { f: 'Nadia', l: 'Brooks', text: 'Can we tighten the intro? It runs long.', time: '2h' },
  { f: 'Tom', l: 'Reyes', text: 'Agreed. The second paragraph could go.', time: '1h' },
  { f: 'Ellen', l: 'Park', text: 'Love the new headline.', time: '12m' },
]

function CommentsDrawer() {
  const [open, setOpen] = useState(true)
  return (
    <div
      style={{
        position: 'relative',
        height: 380,
        overflow: 'hidden',
        background: 'var(--bl-bg)',
      }}
    >
      <article style={{ maxWidth: 440, margin: '0 auto', padding: '26px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ flex: 1, margin: 0, fontSize: 22 }}>Launch announcement</h3>
          <Button variant="secondary" size="sm" onPress={() => setOpen(true)}>
            <Icon name="message" size={16} /> {comments.length}
          </Button>
        </div>
        <p style={{ lineHeight: 1.6, color: 'var(--bl-label2)' }}>
          Today we are shipping the new workspace. It is faster, it syncs everywhere, and it
          finally has dark mode.
        </p>
      </article>
      {/* overlay: slides over the page from the right; the scrim closes it */}
      <SideDrawer
        mode="overlay"
        open={open}
        onClose={() => setOpen(false)}
        title="Comments"
        width={300}
      >
        {comments.map((c) => (
          <div
            key={c.text}
            style={{
              display: 'flex',
              gap: 10,
              padding: '10px 14px',
              borderBottom: '1px solid var(--bl-sep)',
            }}
          >
            <Avatar c={c} size={30} />
            <div style={{ fontSize: 13.5, lineHeight: 1.45 }}>
              <strong>{c.f}</strong>{' '}
              <span style={{ color: 'var(--bl-label3)' }}>{c.time}</span>
              <div>{c.text}</div>
            </div>
          </div>
        ))}
      </SideDrawer>
    </div>
  )
}

export default function CommentsOverlay() {
  return (
    <Window>
      <CommentsDrawer />
    </Window>
  )
}

/** A rounded window with the page background; `width` caps it (phone-sized examples), centered. */
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
        background: 'var(--bl-bg)',
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}
