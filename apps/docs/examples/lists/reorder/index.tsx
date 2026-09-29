import { useState, type ReactNode } from 'react'
import { Button, List, ListRow, ListSection } from '@brett_lamy/ui'

const LIBRARY = [
  'Golden Hour',
  'Nightcall',
  'Midnight City',
  'Heat Waves',
  'Dreams',
  'Cruel Summer',
  'Redbone',
]

function Artwork({ title }: { title: string }) {
  return (
    <span
      aria-hidden
      style={{
        width: 36,
        height: 36,
        borderRadius: 7,
        background: `hsl(${LIBRARY.indexOf(title) * 50} 70% 60%)`,
      }}
    />
  )
}

function UpNext() {
  const [songs, setSongs] = useState(LIBRARY.slice(0, 4))
  const [editing, setEditing] = useState(false)
  const move = (from: number, to: number) =>
    setSongs((s) => {
      const next = [...s]
      const [song] = next.splice(from, 1)
      next.splice(to, 0, song)
      return next
    })
  const add = () =>
    setSongs((s) => {
      const next = LIBRARY.find((t) => !s.includes(t))
      return next ? [next, ...s] : s
    })
  return (
    <div style={{ padding: '10px 0 4px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px 10px',
        }}
      >
        <strong style={{ flex: 1, fontSize: 20 }}>Up Next</strong>
        <Button size="sm" variant="ghost" onPress={add}>
          Add
        </Button>
        <Button size="sm" variant="ghost" onPress={() => setEditing(!editing)}>
          {editing ? 'Done' : 'Edit'}
        </Button>
      </div>
      <List inset>
        {/* `animate`: keyed rows spring in, collapse out, and slide to new
            places. `onReorder` (only while editing) adds a grip: drag it, or
            focus it and press ↑ / ↓. */}
        <ListSection
          animate
          onReorder={editing ? move : undefined}
          footer={
            editing
              ? 'Drag a grip — each new slot ticks.'
              : 'Swipe a song left to remove it.'
          }
        >
          {songs.map((t, i) => (
            <ListRow
              key={t}
              leading={<Artwork title={t} />}
              title={t}
              subtitle={`Track ${LIBRARY.indexOf(t) + 1}`}
              trailingActions={
                editing
                  ? undefined
                  : [
                      {
                        label: 'Remove',
                        icon: 'trash',
                        destructive: true,
                        onAction: () =>
                          setSongs((s) => s.filter((x) => x !== t)),
                      },
                    ]
              }
              divider={i < songs.length - 1}
            />
          ))}
        </ListSection>
      </List>
    </div>
  )
}

// A rounded, hairline-bordered window the example sits in; `width` caps it,
// centered.
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
        background: 'var(--muted)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function Reorder() {
  return (
    <Window width={430}>
      <UpNext />
    </Window>
  )
}
