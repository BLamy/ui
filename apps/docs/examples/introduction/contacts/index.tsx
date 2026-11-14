import { useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { IndexBar } from '@/components/ui/index-bar'
import { List, ListRow, ListSection } from '@/components/ui/list'
import {
  NavigationStack,
  NavigationStackBar,
  NavigationStackContent,
  NavigationStackLargeTitle,
  NavigationStackPage,
  NavigationStackSubheader,
  NavigationStackTitle,
} from '@/components/ui/navigation-stack'
import { SearchField } from '@/components/ui/search-field'
import { TabBar } from '@/components/ui/tab-bar'
import { BLProvider } from '@/lib/theme'

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

  return (
    <div style={{ position: 'relative', height: 560, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0 }}>
        <BLProvider>
          <div style={{ position: 'absolute', inset: 0 }}>
            {/* The stack stays mounted while another tab shows, only hidden, so it comes
                back as you left it: the pushed contact, and the list scrolled where it was
                under it. */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: tab === 'contacts' ? undefined : 'none',
              }}
            >
              <NavigationStack
                pages={sel ? ['list', 'detail'] : ['list']}
                onPagesChange={(pages) => {
                  if (pages.length === 1) setSel(null)
                }}
              >
                <NavigationStackPage value="list" grouped>
                  <NavigationStackBar>
                    <NavigationStackTitle>Contacts</NavigationStackTitle>
                  </NavigationStackBar>
                  <NavigationStackContent bottomInset={62}>
                    <NavigationStackLargeTitle />
                    <NavigationStackSubheader>
                      <div style={{ padding: '0 14px 8px' }}>
                        <SearchField
                          value={q}
                          onValueChange={setQ}
                          placeholder="Search"
                        />
                      </div>
                    </NavigationStackSubheader>
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
                                onClick={() => setSel(p)}
                              />
                            ))}
                          </ListSection>
                        </div>
                      ))}
                    </List>
                  </NavigationStackContent>
                  <IndexBar
                    avail={new Set(letters)}
                    top={118}
                    bottom={70}
                    onLetter={(L) =>
                      sections.current[L]?.scrollIntoView({ block: 'start' })
                    }
                  />
                </NavigationStackPage>
                {sel ? (
                  <NavigationStackPage value="detail" grouped>
                    <NavigationStackBar>
                      <NavigationStackTitle>
                        {sel.f + ' ' + sel.l}
                      </NavigationStackTitle>
                    </NavigationStackBar>
                    <NavigationStackContent>
                      <div style={{ padding: '26px 18px', textAlign: 'center' }}>
                        <Avatar c={sel} size={76} style={{ margin: '0 auto' }} />
                        <div style={{ fontSize: 21, fontWeight: 700, marginTop: 12 }}>
                          {sel.f} {sel.l}
                        </div>
                        <div
                          style={{
                            fontSize: 13.5,
                            color: 'var(--muted-foreground)',
                            marginTop: 3,
                          }}
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
                    </NavigationStackContent>
                  </NavigationStackPage>
                ) : null}
              </NavigationStack>
            </div>
            {tab !== 'contacts' && (
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
              value={tab}
              onValueChange={setTab}
              items={[
                { value: 'contacts', icon: 'person', title: 'Contacts' },
                { value: 'recents', icon: 'clock', title: 'Recents' },
                { value: 'settings', icon: 'sliders', title: 'Settings' },
              ]}
            />
          </div>
        </BLProvider>
      </div>
    </div>
  )
}
