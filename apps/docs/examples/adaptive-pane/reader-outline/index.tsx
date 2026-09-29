import { useState, type ReactNode } from 'react'
import {
  AdaptivePane,
  Button,
  Segmented,
  type AdaptivePaneMode,
} from '@brett_lamy/ui'

const outlineModes = [
  { id: 'column', label: 'Docked' },
  { id: 'drawer', label: 'Drawer' },
  { id: 'hidden', label: 'Focus' },
]
const headings = [
  'Overview',
  'Getting started',
  'Composition',
  'Theming',
  'Accessibility',
]

function Reader() {
  // The mode is also just state: let the reader pick how the outline presents.
  const [mode, setMode] = useState<AdaptivePaneMode>('column')
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        height: 360,
        background: 'var(--background)',
      }}
    >
      <AdaptivePane
        mode={mode}
        open={open}
        onClose={() => setOpen(false)}
        columnWidth={190}
        drawerWidth={230}
        columnStyle={{ borderRight: '1px solid var(--border)' }}
      >
        <aside
          style={{
            height: '100%',
            padding: '16px 14px',
            boxSizing: 'border-box',
            background: 'var(--muted)',
            fontSize: 13.5,
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '.06em',
              color: 'var(--muted-foreground)',
              marginBottom: 8,
            }}
          >
            OUTLINE
          </div>
          {headings.map((h, i) => (
            <div
              key={h}
              style={{
                padding: '6px 0',
                color: i === 2 ? 'var(--primary)' : 'var(--foreground)',
                fontWeight: i === 2 ? 600 : 400,
              }}
            >
              {h}
            </div>
          ))}
        </aside>
      </AdaptivePane>
      <article
        style={{ flex: 1, minWidth: 0, padding: '16px 26px', overflow: 'auto' }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 6,
          }}
        >
          <div style={{ width: 250 }}>
            <Segmented
              aria-label="Outline"
              options={outlineModes}
              value={mode}
              onChange={(m) => {
                setMode(m as AdaptivePaneMode)
                setOpen(false)
              }}
            />
          </div>
          {mode === 'drawer' && (
            <Button size="sm" variant="secondary" onPress={() => setOpen(true)}>
              Outline
            </Button>
          )}
        </div>
        <h2 style={{ margin: '14px 0 8px', fontSize: 24 }}>Composition</h2>
        <p
          style={{
            margin: 0,
            lineHeight: 1.65,
            color: 'var(--muted-foreground)',
            maxWidth: 520,
          }}
        >
          The outline keeps its children across modes: docked beside the text, a
          drawer over it, or gone for focused reading.
        </p>
      </article>
    </div>
  )
}

export default function ReaderOutline() {
  return (
    <Window>
      <Reader />
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
