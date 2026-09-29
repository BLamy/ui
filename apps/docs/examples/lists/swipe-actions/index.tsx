import { useState, type ReactNode } from 'react'
import {
  Button,
  List,
  ListRow,
  ListSection,
  type ListRowAction,
} from '@brett_lamy/ui'

const initialMail = [
  { id: 1, from: 'Nadia Brooks', subject: 'Launch checklist', time: '9:41' },
  { id: 2, from: 'Tom Reyes', subject: 'Onboarding copy', time: '8:15' },
  { id: 3, from: 'Ellen Park', subject: 'Design review moved', time: 'Tue' },
  { id: 4, from: 'Omar Haddad', subject: 'Invoice #4012', time: 'Mon' },
]

function Mail() {
  const [mail, setMail] = useState(initialMail)
  const [unread, setUnread] = useState<Set<number>>(new Set([1, 3]))
  const [flagged, setFlagged] = useState<Set<number>>(new Set())
  const [last, setLast] = useState(
    'Swipe a row either way, or focus it and press → / ←.',
  )
  const flip = (set: Set<number>, id: number) => {
    const next = new Set(set)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  }
  return (
    <List>
      <ListSection animate footer={last}>
        {mail.map((m, i) => {
          // Index 0 is the outermost button: a long swipe runs it.
          const leading: ListRowAction[] = [
            {
              label: unread.has(m.id) ? 'Read' : 'Unread',
              icon: 'mail',
              tint: '#0A84FF',
              onAction: () => {
                setUnread((u) => flip(u, m.id))
                const state = unread.has(m.id) ? 'read' : 'unread'
                setLast(`Marked “${m.subject}” ${state}.`)
              },
            },
          ]
          const trailing: ListRowAction[] = [
            {
              label: 'Trash',
              icon: 'trash',
              destructive: true,
              onAction: () => {
                setMail((all) => all.filter((x) => x.id !== m.id))
                setLast(`Trashed “${m.subject}”.`)
              },
            },
            {
              label: flagged.has(m.id) ? 'Unflag' : 'Flag',
              icon: 'starF',
              tint: '#FF9F0A',
              onAction: () => setFlagged((f) => flip(f, m.id)),
            },
            {
              label: 'More',
              icon: 'info',
              tint: '#8E8E93',
              onAction: () => setLast('More…'),
            },
          ]
          return (
            <ListRow
              key={m.id}
              leading={
                <span
                  aria-hidden
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 5,
                    background: unread.has(m.id)
                      ? 'var(--primary)'
                      : 'transparent',
                  }}
                />
              }
              title={
                <span style={{ fontWeight: unread.has(m.id) ? 600 : 400 }}>
                  {m.from}
                </span>
              }
              subtitle={m.subject}
              trailing={
                <span
                  style={{
                    fontSize: 13,
                    color: flagged.has(m.id) ? '#FF9F0A' : 'var(--muted-foreground)',
                  }}
                >
                  {flagged.has(m.id) ? '★ ' : ''}
                  {m.time}
                </span>
              }
              leadingActions={leading}
              trailingActions={trailing}
              onPress={() => setLast(`Opened “${m.subject}”.`)}
              divider={i < mail.length - 1}
            />
          )
        })}
      </ListSection>
      {mail.length === 0 ? (
        <Button
          variant="link"
          style={{ display: 'block', margin: '0 auto 16px' }}
          onPress={() => setMail(initialMail)}
        >
          Restore mail
        </Button>
      ) : null}
    </List>
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
        background: 'var(--card)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function SwipeActions() {
  return (
    <Window width={430}>
      <Mail />
    </Window>
  )
}
