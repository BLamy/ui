import { useRef, useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { IndexBar, alphabetItems } from '@/components/ui/index-bar'
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
import { SearchInput } from '@/components/ui/search-input'
import { Tabs, TabsBar, TabsList, TabsTab } from '@/components/ui/tabs'
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
                <NavigationStackPage value="list" variant="grouped">
                  <NavigationStackBar>
                    <NavigationStackTitle>Contacts</NavigationStackTitle>
                  </NavigationStackBar>
                  <NavigationStackContent bottomInset={62}>
                    <NavigationStackLargeTitle />
                    <NavigationStackSubheader>
                      <div style={{ padding: '0 14px 8px' }}>
                        <SearchInput
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
                                icon={<Avatar name={`${p.f} ${p.l}`} size={36} />}
                                title={p.f + ' ' + p.l}
                                description={p.role}
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
                    items={alphabetItems(letters)}
                    className="top-[118px] bottom-[70px]"
                    onJump={(L) =>
                      sections.current[L]?.scrollIntoView({ block: 'start' })
                    }
                  />
                </NavigationStackPage>
                {sel ? (
                  <NavigationStackPage value="detail" variant="grouped">
                    <NavigationStackBar>
                      <NavigationStackTitle>
                        {sel.f + ' ' + sel.l}
                      </NavigationStackTitle>
                    </NavigationStackBar>
                    <NavigationStackContent>
                      <div style={{ padding: '26px 18px', textAlign: 'center' }}>
                        <Avatar name={`${sel.f} ${sel.l}`} size={76} style={{ margin: '0 auto' }} />
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
            <Tabs
              variant="bar"
              value={tab}
              onValueChange={(next) => {
                if (next) setTab(next)
              }}
              className="contents"
            >
              <TabsBar>
                <TabsList aria-label="Tabs">
                  <TabsTab value="contacts" icon="person">Contacts</TabsTab>
                  <TabsTab value="recents" icon="clock">Recents</TabsTab>
                  <TabsTab value="settings" icon="sliders">Settings</TabsTab>
                </TabsList>
              </TabsBar>
            </Tabs>
          </div>
        </BLProvider>
      </div>
    </div>
  )
}
