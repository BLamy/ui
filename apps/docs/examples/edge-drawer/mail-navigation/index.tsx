import { useState, type ReactNode } from 'react'
import { Button, EdgeDrawer, Icon, List, ListRow, ListSection } from '@brett_lamy/ui'

const folders = [
  { id: 'inbox', icon: 'mail', label: 'Inbox', count: 12 },
  { id: 'starred', icon: 'star', label: 'Starred', count: 0 },
  { id: 'sent', icon: 'share', label: 'Sent', count: 0 },
  { id: 'trash', icon: 'trash', label: 'Trash', count: 3 },
]

function MailNavigation() {
  const [open, setOpen] = useState(true)
  const [folder, setFolder] = useState('inbox')
  const current = folders.find((f) => f.id === folder)!
  return (
    // The host must be positioned: the scrim and panel fill it, not the window.
    <div
      style={{
        position: 'relative',
        height: 380,
        overflow: 'hidden',
        background: 'var(--bl-bg)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderBottom: '1px solid var(--bl-sep)',
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Folders"
          onPress={() => setOpen(true)}
        >
          <Icon name="sidebar" size={22} />
        </Button>
        <strong style={{ fontSize: 17 }}>{current.label}</strong>
      </header>
      <p style={{ padding: '24px 20px', color: 'var(--bl-label2)' }}>
        {current.count || 'No'} messages in {current.label}.
      </p>
      <EdgeDrawer
        side="left"
        open={open}
        onClose={() => setOpen(false)}
        width={260}
        maxWidth="84%"
      >
        <nav style={{ height: '100%', background: 'var(--bl-bg2)', paddingTop: 18 }}>
          <div style={{ padding: '0 20px 12px', fontSize: 24, fontWeight: 800 }}>
            Mailboxes
          </div>
          <List inset>
            <ListSection>
              {folders.map((f, i) => (
                <ListRow
                  key={f.id}
                  leading={
                    <Icon name={f.icon} size={20} style={{ color: 'var(--bl-tint)' }} />
                  }
                  title={f.label}
                  selected={f.id === folder}
                  divider={i < folders.length - 1}
                  trailing={
                    f.count ? (
                      <span style={{ color: 'var(--bl-label2)' }}>{f.count}</span>
                    ) : null
                  }
                  onPress={() => {
                    setFolder(f.id)
                    setOpen(false)
                  }}
                />
              ))}
            </ListSection>
          </List>
        </nav>
      </EdgeDrawer>
    </div>
  )
}

/** The rounded, hairline-bordered window the example sits in, capped to a phone width and centered. */
function Window({ width, children }: { width?: number; children: ReactNode }) {
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

export default function MailNavigationExample() {
  return (
    <Window width={430}>
      <MailNavigation />
    </Window>
  )
}
