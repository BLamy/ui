import { useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { List, ListRow, ListSection } from '@/components/ui/list'
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackLargeTitle,
  NavigationStackPage,
  NavigationStackSubheader,
  NavigationStackTitle,
  NavigationStackTrailing,
} from '@/components/ui/navigation-stack'
import { SearchInput } from '@/components/ui/search-input'
import { Icon } from '@/lib/icon'

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
  return (
    <div style={{ position: 'relative', height: 460 }}>
      <NavigationStack
        pages={open ? ['list', 'detail'] : ['list']}
        onPagesChange={(pages) => {
          if (pages.length === 1) setOpen(null)
        }}
      >
        <NavigationStackPage value="list">
          <NavigationStackBar hideOnScroll={false}>
            <NavigationStackTitle>Contacts</NavigationStackTitle>
          </NavigationStackBar>
          <NavigationStackContent>
            {/* collapses into the bar as you scroll */}
            <NavigationStackLargeTitle />
            <NavigationStackSubheader>
              <SearchInput value={q} onValueChange={setQ} />
            </NavigationStackSubheader>
            <List>
              <ListSection>
                {hits.map((c, i) => (
                  <ListRow
                    key={c.l}
                    icon={<Avatar name={`${c.f} ${c.l}`} size={36} />}
                    title={`${c.f} ${c.l}`}
                    divider={i < hits.length - 1}
                    onClick={() => setOpen(c)}
                  />
                ))}
              </ListSection>
            </List>
          </NavigationStackContent>
        </NavigationStackPage>
        {open ? (
          <NavigationStackPage value="detail" grouped>
            <NavigationStackBar hideOnScroll={false}>
              {/* the bar title fades in once the header scrolls away */}
              <NavigationStackTitle showOnScroll>
                {open.f} {open.l}
              </NavigationStackTitle>
              <NavigationStackTrailing>
                <Button variant="link" style={{ padding: '0 12px' }}>
                  Edit
                </Button>
              </NavigationStackTrailing>
            </NavigationStackBar>
            <NavigationStackContent>
              <div style={{ textAlign: 'center', padding: '8px 0 18px' }}>
                <Avatar name={`${open.f} ${open.l}`} size={84} style={{ margin: '0 auto' }} />
                <div style={{ fontSize: 26, fontWeight: 700, marginTop: 10 }}>
                  {open.f} {open.l}
                </div>
              </div>
              <List variant="inset">
                <ListSection>
                  <ListRow
                    title="Phone"
                    description={open.phone}
                    trailing={
                      <Icon
                        name="phone"
                        size={20}
                        style={{ color: 'var(--primary)' }}
                      />
                    }
                  />
                  <ListRow
                    title="Email"
                    description={open.email}
                    divider={false}
                    trailing={
                      <Icon
                        name="mail"
                        size={20}
                        style={{ color: 'var(--primary)' }}
                      />
                    }
                  />
                </ListSection>
              </List>
            </NavigationStackContent>
          </NavigationStackPage>
        ) : null}
      </NavigationStack>
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

export default function ContactsLargeTitleExample() {
  return (
    <Window width={430}>
      <ContactsLargeTitle />
    </Window>
  )
}
