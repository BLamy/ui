/* AdaptivePane page examples. Each `// #region` is shown verbatim as the example's code. */
import { useState } from 'react'
import {
  AdaptivePane,
  Avatar,
  Button,
  Icon,
  List,
  ListRow,
  ListSection,
  Segmented,
  useContainerWidth,
  type AdaptivePaneMode,
} from '@brett_lamy/ui'
import raw from './adaptive-pane.tsx?raw'
import { Window, examples } from './chrome'

// #region adaptive_mail
const boxes = ['Inbox', 'Drafts', 'Sent', 'Archive']

export function MailShell() {
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
// #endregion

// #region adaptive_detail
const team = [
  { f: 'Maya', l: 'Lindqvist', role: 'Industrial design' },
  { f: 'Jonas', l: 'Ito', role: 'Haptics engineering' },
  { f: 'Priya', l: 'Raman', role: 'Research' },
]

export function TeamDirectory() {
  const [ref, width] = useContainerWidth()
  const [sel, setSel] = useState<(typeof team)[number] | null>(team[0])
  const compact = width < 600
  // Wide: the detail is a column beside the list. Compact: it covers the list until you close it.
  const mode: AdaptivePaneMode = compact ? (sel ? 'cover' : 'hidden') : 'column'
  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        display: 'flex',
        height: 340,
        background: 'var(--bl-bg2)',
      }}
    >
      <main style={{ flex: 1, minWidth: 0, paddingTop: 14 }}>
        <List inset>
          <ListSection title="Team">
            {team.map((p, i) => (
              <ListRow
                key={p.l}
                leading={<Avatar c={p} size={34} />}
                title={`${p.f} ${p.l}`}
                accessory="chevron"
                selected={!compact && sel === p}
                divider={i < team.length - 1}
                onPress={() => setSel(p)}
              />
            ))}
          </ListSection>
        </List>
      </main>
      <AdaptivePane
        mode={mode}
        side="right"
        columnWidth={260}
        zIndex={10}
        columnStyle={{ borderLeft: '1px solid var(--bl-sep)' }}
      >
        <div
          style={{
            height: '100%',
            padding: 20,
            boxSizing: 'border-box',
            background: 'var(--bl-bg)',
            textAlign: 'center',
          }}
        >
          {compact && (
            <Button
              variant="link"
              style={{ display: 'block' }}
              onPress={() => setSel(null)}
            >
              ‹ Team
            </Button>
          )}
          {sel ? (
            <>
              <Avatar c={sel} size={72} style={{ margin: '14px auto 10px' }} />
              <div style={{ fontSize: 19, fontWeight: 700 }}>
                {sel.f} {sel.l}
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--bl-label2)', marginTop: 4 }}>
                {sel.role}
              </div>
            </>
          ) : (
            <div style={{ marginTop: 40, color: 'var(--bl-label2)' }}>Select a person</div>
          )}
        </div>
      </AdaptivePane>
    </div>
  )
}
// #endregion

// #region adaptive_reader
const outlineModes = [
  { id: 'column', label: 'Docked' },
  { id: 'drawer', label: 'Drawer' },
  { id: 'hidden', label: 'Focus' },
]
const headings = ['Overview', 'Getting started', 'Composition', 'Theming', 'Accessibility']

export function Reader() {
  // The mode is also just state: let the reader pick how the outline presents.
  const [mode, setMode] = useState<AdaptivePaneMode>('column')
  const [open, setOpen] = useState(false)
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        height: 360,
        background: 'var(--bl-bg)',
      }}
    >
      <AdaptivePane
        mode={mode}
        open={open}
        onClose={() => setOpen(false)}
        columnWidth={190}
        drawerWidth={230}
        columnStyle={{ borderRight: '1px solid var(--bl-sep)' }}
      >
        <aside
          style={{
            height: '100%',
            padding: '16px 14px',
            boxSizing: 'border-box',
            background: 'var(--bl-bg2)',
            fontSize: 13.5,
          }}
        >
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              letterSpacing: '.06em',
              color: 'var(--bl-label2)',
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
                color: i === 2 ? 'var(--bl-tint)' : 'var(--bl-label)',
                fontWeight: i === 2 ? 600 : 400,
              }}
            >
              {h}
            </div>
          ))}
        </aside>
      </AdaptivePane>
      <article style={{ flex: 1, minWidth: 0, padding: '16px 26px', overflow: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
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
          style={{ margin: 0, lineHeight: 1.65, color: 'var(--bl-label2)', maxWidth: 520 }}
        >
          The outline keeps its children across modes: docked beside the text, a drawer over
          it, or gone for focused reading.
        </p>
      </article>
    </div>
  )
}
// #endregion

const WIDTH: Record<string, number | undefined> = { wide: undefined, narrow: 390 }
const widthVariants = [
  { id: 'wide', label: 'Wide' },
  { id: 'narrow', label: 'Narrow' },
]

export const ADAPTIVE_PANE_LIVE = examples(raw, [
  {
    id: 'adaptive_mail',
    title: 'Mail shell · column or drawer by width',
    h: 390,
    variants: widthVariants,
    variantsWidth: 190,
    Render: ({ variant }) => (
      <Window width={WIDTH[variant]}>
        <MailShell key={variant} />
      </Window>
    ),
  },
  {
    id: 'adaptive_detail',
    title: 'List and detail · column or cover',
    h: 370,
    variants: widthVariants,
    variantsWidth: 190,
    Render: ({ variant }) => (
      <Window width={WIDTH[variant]}>
        <TeamDirectory key={variant} />
      </Window>
    ),
  },
  {
    id: 'adaptive_reader',
    title: 'Reader outline · the mode is state',
    h: 390,
    Render: () => (
      <Window>
        <Reader />
      </Window>
    ),
  },
])
