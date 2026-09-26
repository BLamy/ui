/* NavigationStack page examples. Each `// #region` is shown verbatim as the example's code. */
import { useState } from 'react'
import {
  Avatar,
  Button,
  Haptics,
  Icon,
  List,
  ListRow,
  ListSection,
  NavigationStack,
  SearchField,
  Switch,
  type Screen,
} from '@brett_lamy/ui'
import raw from './navigation-stack.tsx?raw'
import { Window, examples } from './chrome'

// #region nav_settings
export function SettingsDrillDown() {
  // The path is the stack: push by appending, pop by dropping the last entry.
  const [path, setPath] = useState<string[]>([])
  const [autoUpdate, setAutoUpdate] = useState(true)
  const push = (key: string) => setPath((p) => [...p, key])
  const detail = (label: string, value: string, last = false) => (
    <ListRow
      title={label}
      divider={!last}
      trailing={<span style={{ color: 'var(--bl-label2)' }}>{value}</span>}
    />
  )
  const screens: Screen[] = [
    {
      key: 'settings',
      title: 'Settings',
      grouped: true,
      hideChromeOnScroll: false,
      content: (
        <List inset>
          <ListSection>
            <ListRow
              leading={<Icon name="gear" size={22} />}
              title="General"
              accessory="chevron"
              onPress={() => push('general')}
            />
            <ListRow
              leading={<Icon name="lock" size={22} />}
              title="Privacy"
              accessory="chevron"
              divider={false}
              onPress={() => push('privacy')}
            />
          </ListSection>
        </List>
      ),
    },
  ]
  for (const key of path) {
    if (key === 'general')
      screens.push({
        key,
        title: 'General',
        grouped: true,
        hideChromeOnScroll: false,
        content: (
          <List inset>
            <ListSection>
              <ListRow title="About" accessory="chevron" onPress={() => push('about')} />
              <ListRow
                title="Software Update"
                accessory="chevron"
                divider={false}
                onPress={() => push('update')}
              />
            </ListSection>
          </List>
        ),
      })
    if (key === 'privacy')
      screens.push({
        key,
        title: 'Privacy',
        grouped: true,
        hideChromeOnScroll: false,
        content: (
          <List inset>
            <ListSection footer="Apps must ask before they use your location.">
              {detail('Location Services', 'On', true)}
            </ListSection>
          </List>
        ),
      })
    if (key === 'about')
      screens.push({
        key,
        title: 'About',
        grouped: true,
        hideChromeOnScroll: false,
        content: (
          <List inset>
            <ListSection>
              {detail('Name', 'Ada’s iPhone')}
              {detail('Version', '26.1')}
              {detail('Model', 'iPhone 17 Pro', true)}
            </ListSection>
          </List>
        ),
      })
    if (key === 'update')
      screens.push({
        key,
        title: 'Software Update',
        grouped: true,
        hideChromeOnScroll: false,
        content: (
          <List inset>
            <ListSection footer="Updates install overnight while charging.">
              <ListRow
                title="Automatic Updates"
                divider={false}
                trailing={
                  <Switch
                    aria-label="Automatic Updates"
                    checked={autoUpdate}
                    onChange={setAutoUpdate}
                  />
                }
              />
            </ListSection>
          </List>
        ),
      })
  }
  return (
    <div style={{ position: 'relative', height: 420 }}>
      <NavigationStack screens={screens} onPop={() => setPath((p) => p.slice(0, -1))} />
    </div>
  )
}
// #endregion

// #region nav_contacts
const contacts = [
  { f: 'Ada', l: 'Lovelace', phone: '+44 20 7946 0018', email: 'ada@engine.io' },
  { f: 'Alan', l: 'Turing', phone: '+44 161 496 0754', email: 'alan@bletchley.uk' },
  { f: 'Grace', l: 'Hopper', phone: '+1 202 555 0147', email: 'grace@navy.mil' },
  { f: 'Katherine', l: 'Johnson', phone: '+1 757 555 0123', email: 'kj@nasa.gov' },
  { f: 'Margaret', l: 'Hamilton', phone: '+1 617 555 0199', email: 'margaret@mit.edu' },
  { f: 'Barbara', l: 'Liskov', phone: '+1 617 555 0102', email: 'liskov@mit.edu' },
]

export function ContactsLargeTitle() {
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
      subheader: <SearchField q={q} setQ={setQ} />,
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
      titleOnScroll: true, // the bar title fades in once the header scrolls away
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
                  <Icon name="phone" size={20} style={{ color: 'var(--bl-tint)' }} />
                }
              />
              <ListRow
                title="Email"
                subtitle={open.email}
                divider={false}
                trailing={
                  <Icon name="mail" size={20} style={{ color: 'var(--bl-tint)' }} />
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
// #endregion

// #region nav_inbox
const seed = [
  { id: 3, from: 'Nadia Brooks', subject: 'Launch checklist' },
  { id: 2, from: 'Tom Reyes', subject: 'Onboarding copy' },
  { id: 1, from: 'Ellen Park', subject: 'Design review moved' },
]

export function InboxWithActions() {
  const [mail, setMail] = useState(seed)
  const [composing, setComposing] = useState(false)
  const refresh = () => {
    setMail((m) => [
      { id: m.length + 1, from: 'Priya Raman', subject: `Standup notes #${m.length + 1}` },
      ...m,
    ])
    Haptics.notification('success')
  }
  const screens: Screen[] = [
    {
      key: 'inbox',
      title: 'Inbox',
      hideChromeOnScroll: false,
      onRefresh: refresh, // pull down to refresh
      leading: (
        <Button variant="link" style={{ padding: '0 10px' }}>
          Edit
        </Button>
      ),
      trailing: (
        <Button
          variant="ghost"
          size="icon"
          aria-label="New message"
          onPress={() => setComposing(true)}
        >
          <Icon name="compose" size={22} style={{ color: 'var(--bl-tint)' }} />
        </Button>
      ),
      content: (
        <List>
          <ListSection footer="Pull down to check for new mail.">
            {mail.map((m, i) => (
              <ListRow
                key={m.id}
                title={m.from}
                subtitle={m.subject}
                divider={i < mail.length - 1}
                onPress={() => {}}
              />
            ))}
          </ListSection>
        </List>
      ),
    },
  ]
  if (composing)
    screens.push({
      key: 'compose',
      title: 'New Message',
      hideChromeOnScroll: false,
      trailing: (
        <Button size="sm" style={{ marginRight: 8 }} onPress={() => setComposing(false)}>
          Send
        </Button>
      ),
      content: (
        <div style={{ padding: '4px 16px', fontSize: 16 }}>
          <div
            style={{
              padding: '10px 0',
              borderBottom: '1px solid var(--bl-sep)',
              color: 'var(--bl-label2)',
            }}
          >
            To: Design team
          </div>
          <div style={{ padding: '10px 0', borderBottom: '1px solid var(--bl-sep)' }}>
            Subject: Friday demo
          </div>
          <p style={{ color: 'var(--bl-label2)' }}>
            Send pops the screen by clearing the state that pushed it.
          </p>
        </div>
      ),
    })
  return (
    <div style={{ position: 'relative', height: 400 }}>
      <NavigationStack screens={screens} onPop={() => setComposing(false)} />
    </div>
  )
}
// #endregion

export const NAVIGATION_STACK_LIVE = examples(raw, [
  {
    id: 'nav_settings',
    title: 'Settings drill-down · three levels',
    h: 450,
    Render: () => (
      <Window width={430}>
        <SettingsDrillDown />
      </Window>
    ),
  },
  {
    id: 'nav_contacts',
    title: 'Large title, search subheader, detail',
    h: 490,
    Render: () => (
      <Window width={430}>
        <ContactsLargeTitle />
      </Window>
    ),
  },
  {
    id: 'nav_inbox',
    title: 'Bar buttons and pull to refresh',
    h: 430,
    Render: () => (
      <Window width={430}>
        <InboxWithActions />
      </Window>
    ),
  },
])
