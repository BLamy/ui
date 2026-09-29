import { useState, type ReactNode } from 'react'
import {
  Avatar,
  Button,
  Icon,
  List,
  ListRow,
  ListSection,
  NavigationStack,
  SearchField,
  type Screen,
} from '@brett_lamy/ui'

const contacts = [
  {
    f: 'Ada',
    l: 'Lovelace',
    phone: '+44 20 7946 0018',
    email: 'ada@engine.io',
  },
  {
    f: 'Alan',
    l: 'Turing',
    phone: '+44 161 496 0754',
    email: 'alan@bletchley.uk',
  },
  {
    f: 'Grace',
    l: 'Hopper',
    phone: '+1 202 555 0147',
    email: 'grace@navy.mil',
  },
  {
    f: 'Katherine',
    l: 'Johnson',
    phone: '+1 757 555 0123',
    email: 'kj@nasa.gov',
  },
  {
    f: 'Margaret',
    l: 'Hamilton',
    phone: '+1 617 555 0199',
    email: 'margaret@mit.edu',
  },
  {
    f: 'Barbara',
    l: 'Liskov',
    phone: '+1 617 555 0102',
    email: 'liskov@mit.edu',
  },
]

function ContactsLargeTitle() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<(typeof contacts)[number] | null>(null)
  const hits = contacts.filter((c) =>
    `${c.f} ${c.l}`.toLowerCase().includes(q.toLowerCase()),
  )
  const screens: Screen[] = [
    {
      key: 'list',
      title: 'Contacts',
      largeTitle: true, // collapses into the bar as you scroll
      hideChromeOnScroll: false,
      subheader: <SearchField value={q} onChange={setQ} />,
      content: (
        <List>
          <ListSection>
            {hits.map((c, i) => (
              <ListRow
                key={c.l}
                leading={<Avatar c={c} size={36} />}
                title={`${c.f} ${c.l}`}
                divider={i < hits.length - 1}
                onPress={() => setOpen(c)}
              />
            ))}
          </ListSection>
        </List>
      ),
    },
  ]
  if (open)
    screens.push({
      key: 'detail',
      title: `${open.f} ${open.l}`,
      // the bar title fades in once the header scrolls away
      titleOnScroll: true,
      grouped: true,
      hideChromeOnScroll: false,
      trailing: (
        <Button variant="link" style={{ padding: '0 12px' }}>
          Edit
        </Button>
      ),
      content: (
        <>
          <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
            <Avatar c={open} size={84} style={{ margin: '0 auto' }} />
            <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>
              {open.f} {open.l}
            </div>
          </div>
          <List inset>
            <ListSection>
              <ListRow
                title="Phone"
                subtitle={open.phone}
                trailing={
                  <Icon
                    name="phone"
                    size={20}
                    style={{ color: 'var(--bl-tint)' }}
                  />
                }
              />
              <ListRow
                title="Email"
                subtitle={open.email}
                divider={false}
                trailing={
                  <Icon
                    name="mail"
                    size={20}
                    style={{ color: 'var(--bl-tint)' }}
                  />
                }
              />
            </ListSection>
          </List>
        </>
      ),
    })
  return (
    <div style={{ position: 'relative', height: 460 }}>
      <NavigationStack screens={screens} onPop={() => setOpen(null)} />
    </div>
  )
}

/**
 * The rounded, hairline-bordered window the example sits in, capped to a phone
 * width and centered.
 */
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

export default function ContactsLargeTitleExample() {
  return (
    <Window width={430}>
      <ContactsLargeTitle />
    </Window>
  )
}
