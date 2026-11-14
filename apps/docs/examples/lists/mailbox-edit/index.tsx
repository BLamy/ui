import { useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { Toolbar, ToolbarButton, ToolbarText } from '@/components/ui/toolbar'

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
        background: 'var(--card)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '10px 16px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <strong style={{ flex: 1, fontSize: 17 }}>Inbox</strong>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
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
              editing={editing}
              checked={picked.has(m.id)}
              icon={<Avatar name={`${m.f} ${m.l}`} size={36} />}
              title={m.subject}
              description={`${m.f} ${m.l}`}
              trailing={
                <span style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
                  {m.time}
                </span>
              }
              divider={i < mail.length - 1}
              onClick={() => editing && toggle(m.id)}
              trailingActions={[{ label: 'Delete', destructive: true, onAction: () => remove([m.id]) }]}
            />
          ))}
        </ListSection>
      </List>
      {mail.length === 0 && (
        <Button
          variant="link"
          style={{ display: 'block', margin: '0 auto' }}
          onClick={() => setMail(initialMail)}
        >
          Restore mail
        </Button>
      )}
      {editing && (
        <Toolbar variant="bar" aria-label="Edit" className="absolute inset-x-0 bottom-0 z-10">
          <ToolbarButton disabled={!picked.size} onClick={() => setPicked(new Set())}>Favorite</ToolbarButton>
          <ToolbarText aria-live="polite">{picked.size ? `${picked.size} selected` : 'Select items'}</ToolbarText>
          <ToolbarButton
            tone="destructive"
            disabled={!picked.size}
            onClick={() => {
              remove(picked)
              setPicked(new Set())
            }}
          >
            Delete
          </ToolbarButton>
        </Toolbar>
      )}
    </div>
  )
}

// A rounded, hairline-bordered window the example sits in; `width` caps it,
// centered.
function Window({
  width,
  bg = 'var(--background)',
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
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
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
