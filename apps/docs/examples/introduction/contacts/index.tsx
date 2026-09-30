import { useRef, useState } from 'react'
import {
  Avatar,
  BLProvider,
  IndexBar,
  List,
  ListRow,
  ListSection,
  NavigationStack,
  SearchField,
  TabBar,
  type Screen,
} from '@brett_lamy/ui'

type Person = { f: string; l: string; role: string }

const PEOPLE: Person[] = [
  { f: 'Ada', l: 'Lovelace', role: 'Analytical engines' },
  { f: 'Avi', l: 'Chen', role: 'Sound design' },
  { f: 'Bea', l: 'Okafor', role: 'Motion research' },
  { f: 'Ben', l: 'Alvarez', role: 'Motion' },
  { f: 'Cal', l: 'Nguyen', role: 'Type systems' },
  { f: 'Dot', l: 'Kim', role: 'Interaction physics' },
  { f: 'Eli', l: 'Sato', role: 'Springs' },
  { f: 'Eva', l: 'Marsh', role: 'Color science' },
  { f: 'Fay', l: 'Ito', role: 'Gestures' },
  { f: 'Gus', l: 'Holt', role: 'Accessibility' },
  { f: 'Maya', l: 'Lindqvist', role: 'Industrial design' },
  { f: 'Zoe', l: 'Park', role: 'Prototyping' },
]

// A searchable, lettered contact list in a stack, under a tab bar.
export default function Contacts() {
  const [tab, setTab] = useState('contacts')
  const [sel, setSel] = useState<Person | null>(null)
  const [q, setQ] = useState('')
  const sections = useRef<Record<string, HTMLDivElement | null>>({})

  const people = PEOPLE.filter((p) =>
    (p.f + ' ' + p.l).toLowerCase().includes(q.toLowerCase()),
  )
  const byLetter: Record<string, Person[]> = {}
  for (const p of people) (byLetter[p.f[0]] ??= []).push(p)
  const letters = Object.keys(byLetter).sort()

  const screens: Screen[] = [
    {
      key: 'list',
      title: 'Contacts',
      largeTitle: true,
      grouped: true,
      bottomInset: 62,
      subheader: (
        <div style={{ padding: '0 14px 8px' }}>
          <SearchField value={q} onChange={setQ} placeholder="Search" />
        </div>
      ),
      overlay: (
        <IndexBar
          avail={new Set(letters)}
          top={118}
          bottom={70}
          onLetter={(L) =>
            sections.current[L]?.scrollIntoView({ block: 'start' })
          }
        />
      ),
      content: (
        <List>
          {letters.map((L) => (
            <div
              key={L}
              ref={(el) => {
                sections.current[L] = el
              }}
            >
              <ListSection title={L} sticky>
                {byLetter[L].map((p, i) => (
                  <ListRow
                    key={p.f + p.l}
                    leading={<Avatar c={p} size={36} />}
                    title={p.f + ' ' + p.l}
                    subtitle={p.role}
                    accessory="chevron"
                    divider={i < byLetter[L].length - 1}
                    onPress={() => setSel(p)}
                  />
                ))}
              </ListSection>
            </div>
          ))}
        </List>
      ),
    },
  ]
  if (sel)
    screens.push({
      key: 'detail',
      title: sel.f + ' ' + sel.l,
      grouped: true,
      content: (
        <div style={{ padding: '26px 18px', textAlign: 'center' }}>
          <Avatar c={sel} size={76} style={{ margin: '0 auto' }} />
          <div style={{ fontSize: 21, fontWeight: 700, marginTop: 12 }}>
            {sel.f} {sel.l}
          </div>
          <div
            style={{ fontSize: 13.5, color: 'var(--muted-foreground)', marginTop: 3 }}
          >
            {sel.role}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: 'var(--muted-foreground)',
              marginTop: 22,
              lineHeight: 1.5,
            }}
          >
            Edge-swipe from the left or use the back chevron to pop.
          </div>
        </div>
      ),
    })

  return (
    <div style={{ position: 'relative', height: 560, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <BLProvider>
          <div style={{ position: 'absolute', inset: 0 }}>
            {tab === 'contacts' ? (
              <NavigationStack screens={screens} onPop={() => setSel(null)} />
            ) : (
              <div
                style={{
                  position: 'absolute',
                  inset: '0 0 62px',
                  display: 'grid',
                  placeItems: 'center',
                  textAlign: 'center',
                  padding: 24,
                }}
              >
                <div>
                  <div style={{ fontSize: 16.5, fontWeight: 650 }}>
                    {tab === 'recents' ? 'Recents' : 'Settings'}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      color: 'var(--muted-foreground)',
                      marginTop: 4,
                    }}
                  >
                    Tab state survives switching away and back.
                  </div>
                </div>
              </div>
            )}
            <TabBar
              selected={tab}
              onSelect={setTab}
              items={[
                { id: 'contacts', icon: 'person', title: 'Contacts' },
                { id: 'recents', icon: 'clock', title: 'Recents' },
                { id: 'settings', icon: 'sliders', title: 'Settings' },
              ]}
            />
          </div>
        </BLProvider>
      </div>
    </div>
  )
}
