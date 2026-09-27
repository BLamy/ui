import { useState, type ReactNode } from 'react'
import {
  AdaptivePane,
  Button,
  Icon,
  List,
  ListRow,
  ListSection,
  useContainerWidth,
} from '@brett_lamy/ui'

const boxes = ['Inbox', 'Drafts', 'Sent', 'Archive']

function MailShell() {
  const [ref, width] = useContainerWidth()
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState('Inbox')
  const compact = width < 600
  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        display: 'flex',
        height: 360,
        background: 'var(--bl-bg)',
      }}
    >
      <AdaptivePane
        mode={compact ? 'drawer' : 'column'}
        open={open}
        onClose={() => setOpen(false)}
        columnWidth={200}
        drawerWidth={250}
        columnStyle={{ borderRight: '1px solid var(--bl-sep)' }}
      >
        <nav
          style={{
            height: '100%',
            padding: '14px 8px',
            boxSizing: 'border-box',
            background: 'var(--bl-side)',
          }}
        >
          {boxes.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => {
                setBox(b)
                setOpen(false)
              }}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: 0,
                borderRadius: 8,
                textAlign: 'left',
                cursor: 'pointer',
                font: 'inherit',
                fontSize: 14,
                color: 'var(--bl-label)',
                background: b === box ? 'var(--bl-fill2)' : 'transparent',
              }}
            >
              {b}
            </button>
          ))}
        </nav>
      </AdaptivePane>
      <main style={{ flex: 1, minWidth: 0 }}>
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '8px 12px',
            borderBottom: '1px solid var(--bl-sep)',
          }}
        >
          {compact && (
            <Button
              variant="ghost"
              size="icon"
              aria-label="Mailboxes"
              onPress={() => setOpen(true)}
            >
              <Icon name="sidebar" />
            </Button>
          )}
          <strong style={{ fontSize: 16 }}>{box}</strong>
          <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--bl-label2)' }}>
            {Math.round(width)}px · {compact ? 'drawer' : 'column'}
          </span>
        </header>
        <List>
          <ListSection>
            {['Launch checklist', 'Offsite agenda', 'Invoice #4012'].map((s, i) => (
              <ListRow
                key={s}
                title={s}
                subtitle={box}
                divider={i < 2}
                onPress={() => {}}
              />
            ))}
          </ListSection>
        </List>
      </main>
    </div>
  )
}

// The host width each variant previews; wide fills the card.
const widths: Record<string, number | undefined> = { wide: undefined, narrow: 390 }

export default function ColumnOrDrawer({ variant = 'wide' }: { variant?: string }) {
  return (
    <Window width={widths[variant]}>
      {/* remount per width so each starts fresh */}
      <MailShell key={variant} />
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
