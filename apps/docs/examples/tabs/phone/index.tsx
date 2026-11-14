import { type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { Tabs, TabsBar, TabsList, TabsPanel, TabsPanels, TabsTab } from '@/components/ui/tabs'

const recents = [
  { f: 'Maya', l: 'Lindqvist', kind: 'mobile', time: '9:41 AM', missed: false },
  { f: 'Jonas', l: 'Ito', kind: 'FaceTime', time: '8:02 AM', missed: true },
  { f: 'Priya', l: 'Raman', kind: 'work', time: 'Yesterday', missed: false },
  { f: 'Leo', l: 'Okafor', kind: 'mobile', time: 'Monday', missed: false },
]

function TabScreen({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    // The bar floats over the panel, so leave room for its 62px.
    <div style={{ padding: '14px 0 80px' }}>
      <h2 style={{ margin: '0 20px 12px', fontSize: 30, fontWeight: 800 }}>
        {title}
      </h2>
      {children}
    </div>
  )
}

function PhoneApp() {
  return (
    <Tabs
      variant="bar"
      defaultValue="recents"
      style={{ position: 'relative', height: 440 }}
    >
      <TabsBar hideOnScroll={false}>
        <TabsList aria-label="Phone">
          <TabsTab value="favorites" icon="star">
            Favorites
          </TabsTab>
          <TabsTab value="recents" icon="clock">
            Recents
          </TabsTab>
          <TabsTab value="contacts" icon="person">
            Contacts
          </TabsTab>
          <TabsTab value="voicemail" icon="wave">
            Voicemail
          </TabsTab>
        </TabsList>
      </TabsBar>
      <TabsPanels>
        <TabsPanel value="favorites">
          <TabScreen title="Favorites">
            <List variant="inset">
              <ListSection>
                <ListRow
                  icon={<Avatar name={`${recents[0].f} ${recents[0].l}`} size={34} />}
                  title="Maya"
                  description="mobile"
                  divider={false}
                />
              </ListSection>
            </List>
          </TabScreen>
        </TabsPanel>
        <TabsPanel value="recents">
          <TabScreen title="Recents">
            <List variant="inset">
              <ListSection>
                {recents.map((c, i) => (
                  <ListRow
                    key={c.l}
                    title={
                      <span
                        style={{
                          color: c.missed ? 'var(--destructive)' : undefined,
                        }}
                      >
                        {c.f} {c.l}
                      </span>
                    }
                    description={c.kind}
                    trailing={
                      <span style={{ fontSize: 14, color: 'var(--muted-foreground)' }}>
                        {c.time}
                      </span>
                    }
                    divider={i < recents.length - 1}
                  />
                ))}
              </ListSection>
            </List>
          </TabScreen>
        </TabsPanel>
        <TabsPanel value="contacts">
          <TabScreen title="Contacts">
            <List variant="inset">
              <ListSection>
                {recents.map((c, i) => (
                  <ListRow
                    key={c.l}
                    icon={<Avatar name={`${c.f} ${c.l}`} size={34} />}
                    title={`${c.f} ${c.l}`}
                    accessory="chevron"
                    divider={i < recents.length - 1}
                    onClick={() => {}}
                  />
                ))}
              </ListSection>
            </List>
          </TabScreen>
        </TabsPanel>
        <TabsPanel value="voicemail">
          <TabScreen title="Voicemail">
            <p
              style={{
                margin: '40px 20px',
                textAlign: 'center',
                color: 'var(--muted-foreground)',
              }}
            >
              No voicemail
            </p>
          </TabScreen>
        </TabsPanel>
      </TabsPanels>
    </Tabs>
  )
}

/**
 * The rounded, hairline-bordered window the example sits in, capped to a phone
 * width and centered.
 */
function Window({
  width,
  children,
  bg = 'var(--background)',
}: {
  width?: number
  children: ReactNode
  bg?: string
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

export default function PhoneTabs() {
  return (
    <Window width={390} bg="var(--muted)">
      <PhoneApp />
    </Window>
  )
}
