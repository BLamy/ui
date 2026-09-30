import { type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { TabView, TabViewBar, TabViewList, TabViewPanel, TabViewPanels, TabViewTab } from '@/components/ui/tab-view'

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
    <TabView
      defaultSelectedKey="recents"
      style={{ position: 'relative', height: 440 }}
    >
      <TabViewBar hideOnScroll={false}>
        <TabViewList aria-label="Phone">
          <TabViewTab id="favorites" icon="star" title="Favorites" />
          <TabViewTab id="recents" icon="clock" title="Recents" />
          <TabViewTab id="contacts" icon="person" title="Contacts" />
          <TabViewTab id="voicemail" icon="wave" title="Voicemail" />
        </TabViewList>
      </TabViewBar>
      <TabViewPanels>
        <TabViewPanel id="favorites">
          <TabScreen title="Favorites">
            <List inset>
              <ListSection>
                <ListRow
                  leading={<Avatar c={recents[0]} size={34} />}
                  title="Maya"
                  subtitle="mobile"
                  divider={false}
                />
              </ListSection>
            </List>
          </TabScreen>
        </TabViewPanel>
        <TabViewPanel id="recents">
          <TabScreen title="Recents">
            <List inset>
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
                    subtitle={c.kind}
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
        </TabViewPanel>
        <TabViewPanel id="contacts">
          <TabScreen title="Contacts">
            <List inset>
              <ListSection>
                {recents.map((c, i) => (
                  <ListRow
                    key={c.l}
                    leading={<Avatar c={c} size={34} />}
                    title={`${c.f} ${c.l}`}
                    accessory="chevron"
                    divider={i < recents.length - 1}
                    onPress={() => {}}
                  />
                ))}
              </ListSection>
            </List>
          </TabScreen>
        </TabViewPanel>
        <TabViewPanel id="voicemail">
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
        </TabViewPanel>
      </TabViewPanels>
    </TabView>
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

export default function PhoneTabBar() {
  return (
    <Window width={390} bg="var(--muted)">
      <PhoneApp />
    </Window>
  )
}
