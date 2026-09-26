/* List page examples. Each `// #region` is shown verbatim as the example's code. */
import { useRef, useState } from 'react'
import {
  Avatar,
  Button,
  EditBar,
  Icon,
  IndexBar,
  List,
  ListRow,
  ListSection,
  SearchField,
  Switch,
} from '@brett_lamy/ui'
import raw from './list.tsx?raw'
import { Window, examples } from './chrome'

// #region list_settings
function Tile({ icon, color }: { icon: string; color: string }) {
  return (
    <span
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 29,
        height: 29,
        borderRadius: 7,
        background: color,
        color: '#fff',
      }}
    >
      <Icon name={icon} size={18} sw={2} />
    </span>
  )
}

export function SettingsList() {
  const [airplane, setAirplane] = useState(false)
  const [dnd, setDnd] = useState(true)
  const value = (text: string) => (
    <span style={{ color: 'var(--bl-label2)', fontSize: 16 }}>{text}</span>
  )
  return (
    <div style={{ padding: '18px 0' }}>
      <List inset>
        <ListSection>
          <ListRow
            leading={<Tile icon="drop" color="#FF9500" />}
            title="Airplane Mode"
            trailing={
              <Switch
                aria-label="Airplane Mode"
                checked={airplane}
                onChange={setAirplane}
              />
            }
          />
          <ListRow
            leading={<Tile icon="wifi" color="#0A84FF" />}
            title="Wi-Fi"
            trailing={value(airplane ? 'Off' : 'Home')}
            accessory="chevron"
            onPress={() => {}}
          />
          <ListRow
            leading={<Tile icon="link" color="#0A84FF" />}
            title="Bluetooth"
            trailing={value('On')}
            accessory="chevron"
            divider={false}
            onPress={() => {}}
          />
        </ListSection>
        <ListSection footer="Silences calls and notifications while Focus is on.">
          <ListRow
            leading={<Tile icon="bell" color="#FF3B30" />}
            title="Notifications"
            accessory="chevron"
            onPress={() => {}}
          />
          <ListRow
            leading={<Tile icon="wave" color="#FF2D55" />}
            title="Sounds & Haptics"
            accessory="chevron"
            onPress={() => {}}
          />
          <ListRow
            leading={<Tile icon="moon" color="#5E5CE6" />}
            title="Do Not Disturb"
            divider={false}
            trailing={
              <Switch aria-label="Do Not Disturb" checked={dnd} onChange={setDnd} />
            }
          />
        </ListSection>
      </List>
    </div>
  )
}
// #endregion

// #region list_contacts
const people = [
  'Ada Lovelace',
  'Alan Turing',
  'Barbara Liskov',
  'Bjarne Stroustrup',
  'Claude Shannon',
  'Donald Knuth',
  'Edsger Dijkstra',
  'Frances Allen',
  'Grace Hopper',
  'Guido van Rossum',
  'Hedy Lamarr',
  'John McCarthy',
  'Katherine Johnson',
  'Ken Thompson',
  'Linus Torvalds',
  'Margaret Hamilton',
]
const byLetter: Record<string, string[]> = {}
for (const name of people) {
  const letter = name.split(' ').pop()![0] // by last name
  byLetter[letter] = [...(byLetter[letter] ?? []), name]
}
const letters = Object.keys(byLetter).sort()

export function ContactsList() {
  const scroller = useRef<HTMLDivElement>(null)
  const sections = useRef<Record<string, HTMLDivElement | null>>({})
  const jump = (letter: string) => {
    const el = sections.current[letter]
    if (el && scroller.current) scroller.current.scrollTop = el.offsetTop
  }
  return (
    <div style={{ position: 'relative', height: 400, background: 'var(--bl-card)' }}>
      <div
        ref={scroller}
        style={{ position: 'absolute', inset: 0, overflowY: 'auto', paddingRight: 22 }}
      >
        <List>
          {letters.map((letter) => (
            <ListSection
              key={letter}
              title={letter}
              sticky
              innerRef={(el) => {
                sections.current[letter] = el
              }}
            >
              {byLetter[letter].map((name, i) => {
                const [f, ...rest] = name.split(' ')
                return (
                  <ListRow
                    key={name}
                    title={
                      <>
                        <span>{f} </span>
                        <strong>{rest.join(' ')}</strong>
                      </>
                    }
                    divider={i < byLetter[letter].length - 1}
                    onPress={() => {}}
                  />
                )
              })}
            </ListSection>
          ))}
        </List>
      </div>
      <IndexBar avail={new Set(letters)} onLetter={jump} top={8} bottom={8} />
    </div>
  )
}
// #endregion

// #region list_edit
const initialMail = [
  { id: 1, f: 'Nadia', l: 'Brooks', subject: 'Launch checklist', time: '9:41' },
  { id: 2, f: 'Tom', l: 'Reyes', subject: 'Onboarding copy', time: '8:15' },
  { id: 3, f: 'Ellen', l: 'Park', subject: 'Design review moved', time: 'Tue' },
  { id: 4, f: 'Omar', l: 'Haddad', subject: 'Invoice #4012', time: 'Mon' },
]

export function MailboxEdit() {
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
// #endregion

// #region list_choices
const tones = ['Radar', 'Apex', 'Chimes', 'Signal', 'Silk']

export function RingtonePicker() {
  const [tone, setTone] = useState('Radar')
  const [signedIn, setSignedIn] = useState(true)
  return (
    <div style={{ padding: '18px 0' }}>
      <List inset>
        <ListSection
          title="Ringtone"
          footer="The checked tone plays for calls from everyone."
        >
          {tones.map((t, i) => (
            <ListRow
              key={t}
              title={t}
              accessory="check"
              checked={t === tone}
              divider={i < tones.length - 1}
              onPress={() => setTone(t)}
            />
          ))}
        </ListSection>
        <ListSection>
          <ListRow
            center
            destructive={signedIn}
            divider={false}
            title={signedIn ? 'Sign Out' : 'Sign In'}
            onPress={() => setSignedIn(!signedIn)}
          />
        </ListSection>
      </List>
    </div>
  )
}
// #endregion

// #region list_search
const cities = [
  'Amsterdam',
  'Berlin',
  'Copenhagen',
  'Dublin',
  'Lisbon',
  'Madrid',
  'Oslo',
  'Paris',
  'Prague',
  'Vienna',
]

export function CitySearch() {
  const [q, setQ] = useState('')
  const hits = cities.filter((c) => c.toLowerCase().includes(q.toLowerCase()))
  return (
    <div style={{ height: 400, overflowY: 'auto', background: 'var(--bl-bg2)' }}>
      {/* `header` sticks to the top of the list; sections would stick below it */}
      <List
        inset
        header={
          <div style={{ padding: '10px 0' }}>
            <SearchField q={q} setQ={setQ} placeholder="Search cities" />
          </div>
        }
      >
        {hits.length ? (
          <ListSection title={`${hits.length} cities`}>
            {hits.map((c, i) => (
              <ListRow
                key={c}
                title={c}
                leading={<Icon name="pin" size={20} />}
                divider={i < hits.length - 1}
                onPress={() => {}}
              />
            ))}
          </ListSection>
        ) : (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <Icon
              name="search"
              size={40}
              style={{ margin: '0 auto', color: 'var(--bl-label3)' }}
            />
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 12 }}>No Results</div>
            <div style={{ fontSize: 14, color: 'var(--bl-label2)', marginTop: 4 }}>
              Nothing matches “{q}”.
            </div>
            <Button
              variant="secondary"
              size="sm"
              style={{ marginTop: 14 }}
              onPress={() => setQ('')}
            >
              Clear search
            </Button>
          </div>
        )}
      </List>
    </div>
  )
}
// #endregion

export const LIST_LIVE = examples(raw, [
  {
    id: 'list_settings',
    title: 'Settings · switches, values, disclosure',
    h: 440,
    Render: () => (
      <Window width={430} bg="var(--bl-bg2)">
        <SettingsList />
      </Window>
    ),
  },
  {
    id: 'list_contacts',
    title: 'Contacts · sticky headers + A–Z IndexBar',
    h: 430,
    Render: () => (
      <Window width={430}>
        <ContactsList />
      </Window>
    ),
  },
  {
    id: 'list_edit',
    title: 'Mailbox · swipe to delete, edit mode',
    h: 430,
    Render: () => (
      <Window width={430}>
        <MailboxEdit />
      </Window>
    ),
  },
  {
    id: 'list_choices',
    title: 'Single choice and a destructive row',
    h: 470,
    Render: () => (
      <Window width={430} bg="var(--bl-bg2)">
        <RingtonePicker />
      </Window>
    ),
  },
  {
    id: 'list_search',
    title: 'Search header with an empty state',
    h: 430,
    Render: () => (
      <Window width={430} bg="var(--bl-bg2)">
        <CitySearch />
      </Window>
    ),
  },
])
