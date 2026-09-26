/* SideDrawer page examples. Each `// #region` is shown verbatim as the example's code. */
import { useState } from 'react'
import {
  Avatar,
  Button,
  Icon,
  List,
  ListRow,
  ListSection,
  NavigationStack,
  SideDrawer,
  useContainerWidth,
  type Screen,
} from '@brett_lamy/ui'
import raw from './side-drawer.tsx?raw'
import { Window, examples } from './chrome'

// #region sidedrawer_inspector
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

export function FileInspector() {
  const [open, setOpen] = useState(true)
  const [sel, setSel] = useState(files[0])
  return (
    <div style={{ display: 'flex', height: 360, background: 'var(--bl-bg)' }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
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
                  <Icon name={f.icon} size={22} style={{ color: 'var(--bl-tint)' }} />
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
          <div style={{ fontWeight: 650, margin: '12px 0 8px' }}>{sel.name}</div>
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
// #endregion

// #region sidedrawer_comments
const comments = [
  { f: 'Nadia', l: 'Brooks', text: 'Can we tighten the intro? It runs long.', time: '2h' },
  { f: 'Tom', l: 'Reyes', text: 'Agreed. The second paragraph could go.', time: '1h' },
  { f: 'Ellen', l: 'Park', text: 'Love the new headline.', time: '12m' },
]

export function CommentsDrawer() {
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
// #endregion

// #region sidedrawer_adaptive
function Activity() {
  return (
    <div style={{ padding: '4px 0' }}>
      {['Called · 4 min', 'Shared “Q3 plan”', 'Sent 3 messages', 'Joined the team'].map(
        (a) => (
          <div
            key={a}
            style={{
              padding: '11px 16px',
              fontSize: 14,
              borderBottom: '1px solid var(--bl-sep)',
            }}
          >
            {a}
          </div>
        ),
      )}
    </div>
  )
}

export function AdaptiveActivity() {
  const [ref, width] = useContainerWidth()
  const [open, setOpen] = useState(true)
  // One content component, three presentations chosen by the host's width.
  const presentation = width >= 640 ? 'fixed' : width >= 440 ? 'overlay' : 'pushed'
  const profile = (
    <div style={{ padding: 24, textAlign: 'center' }}>
      <Avatar c={{ f: 'Maya', l: 'Lindqvist' }} size={64} style={{ margin: '0 auto' }} />
      <div style={{ fontSize: 20, fontWeight: 700, margin: '10px 0 14px' }}>
        Maya Lindqvist
      </div>
      <Button size="sm" variant="secondary" onPress={() => setOpen(!open)}>
        {open ? 'Hide' : 'Show'} activity
      </Button>
      <div style={{ marginTop: 12, fontSize: 12.5, color: 'var(--bl-label2)' }}>
        Presentation: {presentation}
      </div>
    </div>
  )
  const screens: Screen[] = [
    { key: 'profile', title: 'Profile', content: profile, hideChromeOnScroll: false },
  ]
  if (open)
    screens.push({
      key: 'activity',
      title: 'Activity',
      content: <Activity />,
      hideChromeOnScroll: false,
    })
  return (
    // Measure one stable host; only what is inside it changes with the width.
    <div
      ref={ref}
      style={{
        position: 'relative',
        display: 'flex',
        height: 340,
        background: 'var(--bl-bg)',
      }}
    >
      {presentation === 'pushed' ? (
        <NavigationStack screens={screens} onPop={() => setOpen(false)} />
      ) : (
        <>
          <main style={{ flex: 1, minWidth: 0 }}>{profile}</main>
          <SideDrawer
            mode={presentation}
            open={open}
            onClose={() => setOpen(false)}
            title="Activity"
            width={260}
          >
            <Activity />
          </SideDrawer>
        </>
      )}
    </div>
  )
}
// #endregion

const WIDTHS: Record<string, number | undefined> = {
  wide: undefined,
  tablet: 560,
  phone: 380,
}

export const SIDE_DRAWER_LIVE = examples(raw, [
  {
    id: 'sidedrawer_inspector',
    title: 'Docked inspector · mode="fixed"',
    h: 390,
    Render: () => (
      <Window>
        <FileInspector />
      </Window>
    ),
  },
  {
    id: 'sidedrawer_comments',
    title: 'Comments over the page · mode="overlay"',
    h: 410,
    Render: () => (
      <Window>
        <CommentsDrawer />
      </Window>
    ),
  },
  {
    id: 'sidedrawer_adaptive',
    title: 'One content, three presentations',
    h: 370,
    variants: [
      { id: 'wide', label: 'Wide' },
      { id: 'tablet', label: 'Tablet' },
      { id: 'phone', label: 'Phone' },
    ],
    variantsWidth: 260,
    Render: ({ variant }) => (
      <Window width={WIDTHS[variant]}>
        <AdaptiveActivity key={variant} />
      </Window>
    ),
  },
])
