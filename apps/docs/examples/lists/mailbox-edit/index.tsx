import { useState, type ReactNode } from 'react'
import {
  Avatar,
  Button,
  EditBar,
  List,
  ListRow,
  ListSection,
} from '@brett_lamy/ui'

const initialMail = [
  { id: 1, f: 'Nadia', l: 'Brooks', subject: 'Launch checklist', time: '9:41' },
  { id: 2, f: 'Tom', l: 'Reyes', subject: 'Onboarding copy', time: '8:15' },
  { id: 3, f: 'Ellen', l: 'Park', subject: 'Design review moved', time: 'Tue' },
  { id: 4, f: 'Omar', l: 'Haddad', subject: 'Invoice #4012', time: 'Mon' },
]

function MailboxEdit() {
  const [mail, setMail] = useState(initialMail)
  const [editing, setEditing] = useState(false)
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const toggle = (id: number) =>
    setPicked((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const remove = (ids: Set<number> | number[]) =>
    setMail((m) => m.filter((x) => ![...ids].includes(x.id)))
  return (
    <div
      style={{
        position: 'relative',
        height: 400,
        overflow: 'hidden',
        background: 'var(--bl-card)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid var(--bl-sep)',
        }}
      >
        <strong style={{ flex: 1, fontSize: 17 }}>Inbox</strong>
        <Button
          size="sm"
          variant="ghost"
          onPress={() => {
            setEditing(!editing)
            setPicked(new Set())
          }}
        >
          {editing ? 'Done' : 'Edit'}
        </Button>
      </header>
      <List>
        <ListSection footer={editing ? null : 'Swipe a row left to delete it.'}>
          {mail.map((m, i) => (
            <ListRow
              key={m.id}
              edit={editing}
              checked={picked.has(m.id)}
              leading={<Avatar c={m} size={36} />}
              title={m.subject}
              subtitle={`${m.f} ${m.l}`}
              trailing={
                <span style={{ fontSize: 13, color: 'var(--bl-label2)' }}>{m.time}</span>
              }
              divider={i < mail.length - 1}
              onPress={() => editing && toggle(m.id)}
              onDelete={() => remove([m.id])}
            />
          ))}
        </ListSection>
      </List>
      {mail.length === 0 && (
        <Button
          variant="link"
          style={{ display: 'block', margin: '0 auto' }}
          onPress={() => setMail(initialMail)}
        >
          Restore mail
        </Button>
      )}
      {editing && (
        <EditBar
          count={picked.size}
          onFav={() => setPicked(new Set())}
          onDelete={() => {
            remove(picked)
            setPicked(new Set())
          }}
        />
      )}
    </div>
  )
}

// A rounded, hairline-bordered window the example sits in; `width` caps it, centered.
function Window({
  width,
  bg = 'var(--bl-bg)',
  children,
}: {
  width?: number
  bg?: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: bg,
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function Mailbox() {
  return (
    <Window width={430}>
      <MailboxEdit />
    </Window>
  )
}
