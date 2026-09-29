import { useState, type ReactNode } from 'react'
import {
  Button,
  Icon,
  List,
  ListRow,
  ListSection,
  SideDrawer,
} from '@brett_lamy/ui'

const files = [
  {
    name: 'Brand guidelines.pdf',
    icon: 'doc',
    size: '4.2 MB',
    kind: 'PDF document',
    modified: 'Today, 9:12',
  },
  {
    name: 'Launch photos',
    icon: 'folder',
    size: '318 MB',
    kind: 'Folder',
    modified: 'Yesterday',
  },
  {
    name: 'Hero.png',
    icon: 'photo',
    size: '1.9 MB',
    kind: 'PNG image',
    modified: 'Mon, 16:40',
  },
]

function FileInspector() {
  const [open, setOpen] = useState(true)
  const [sel, setSel] = useState(files[0])
  return (
    <div style={{ display: 'flex', height: 360, background: 'var(--bl-bg)' }}>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '10px 14px',
            borderBottom: '1px solid var(--bl-sep)',
          }}
        >
          <strong style={{ flex: 1 }}>Documents</strong>
          <Button
            variant={open ? 'secondary' : 'ghost'}
            size="sm"
            onPress={() => setOpen(!open)}
          >
            <Icon name="info" size={17} /> Info
          </Button>
        </header>
        <List>
          <ListSection>
            {files.map((f) => (
              <ListRow
                key={f.name}
                leading={
                  <Icon
                    name={f.icon}
                    size={22}
                    style={{ color: 'var(--bl-tint)' }}
                  />
                }
                title={f.name}
                subtitle={f.modified}
                selected={f === sel}
                onPress={() => setSel(f)}
              />
            ))}
          </ListSection>
        </List>
      </div>
      {/* fixed: a docked column that animates its width; no scrim */}
      <SideDrawer
        mode="fixed"
        open={open}
        onClose={() => setOpen(false)}
        title="Info"
        width={250}
      >
        <div style={{ padding: '6px 14px', fontSize: 13.5 }}>
          <div
            style={{
              display: 'grid',
              placeItems: 'center',
              height: 96,
              borderRadius: 12,
              background: 'var(--bl-fill)',
              color: 'var(--bl-tint)',
            }}
          >
            <Icon name={sel.icon} size={40} />
          </div>
          <div style={{ fontWeight: 650, margin: '12px 0 8px' }}>
            {sel.name}
          </div>
          {[
            ['Kind', sel.kind],
            ['Size', sel.size],
            ['Modified', sel.modified],
          ].map(([k, v]) => (
            <div
              key={k}
              style={{
                display: 'flex',
                padding: '7px 0',
                borderTop: '1px solid var(--bl-sep)',
              }}
            >
              <span style={{ flex: 1, color: 'var(--bl-label2)' }}>{k}</span>
              {v}
            </div>
          ))}
        </div>
      </SideDrawer>
    </div>
  )
}

export default function DockedInspector() {
  return (
    <Window>
      <FileInspector />
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
