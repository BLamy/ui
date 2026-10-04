import { useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Credenza } from '@/components/ui/credenza'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { NavigationStack, type Screen } from '@/components/ui/navigation-stack'
import { TabView, TabViewBar, TabViewList, TabViewPanel, TabViewPanels, TabViewTab } from '@/components/ui/tab-view'
import { BLProvider } from '@/lib/theme'

const friends = [
  { f: 'Maya', l: 'Lindqvist', city: 'Stockholm' },
  { f: 'Jonas', l: 'Ito', city: 'Osaka' },
  { f: 'Priya', l: 'Raman', city: 'Bengaluru' },
]

function FriendsTab() {
  const [open, setOpen] = useState<(typeof friends)[number] | null>(null)
  const [inviting, setInviting] = useState(false)
  const screens: Screen[] = [
    {
      key: 'friends',
      title: 'Friends',
      largeTitle: true,
      grouped: true,
      hideChromeOnScroll: false,
      bottomInset: 62,
      content: (
        <List inset>
          <ListSection>
            {friends.map((p, i) => (
              <ListRow
                key={p.l}
                leading={<Avatar c={p} size={34} />}
                title={`${p.f} ${p.l}`}
                subtitle={p.city}
                accessory="chevron"
                divider={i < friends.length - 1}
                onPress={() => setOpen(p)}
              />
            ))}
          </ListSection>
        </List>
      ),
    },
  ]
  if (open)
    screens.push({
      key: 'friend',
      title: open.f,
      grouped: true,
      hideChromeOnScroll: false,
      content: (
        <div style={{ padding: 24, textAlign: 'center' }}>
          <Avatar c={open} size={72} style={{ margin: '0 auto 12px' }} />
          <Button onPress={() => setInviting(true)}>Invite {open.f}</Button>
        </div>
      ),
    })
  return (
    <>
      <NavigationStack screens={screens} onPop={() => setOpen(null)} />
      <Credenza
        compact
        open={inviting}
        title="Invite sent"
        onClose={() => setInviting(false)}
      >
        <p
          style={{
            margin: 0,
            padding: '4px 20px 24px',
            color: 'var(--muted-foreground)',
          }}
        >
          {open?.f} will get a notification.
        </p>
      </Credenza>
    </>
  )
}

// A rounded, phone-width window for the app to live in.
function Window({ width, children }: { width: number; children: ReactNode }) {
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

// Containers own behavior, your state owns data: a tab bar, a stack per tab,
// lists and a tray. shouldForceMount keeps a hidden panel mounted, so each
// tab keeps its own stack while you are on another.
export default function FirstApp() {
  return (
    <Window width={390}>
      <BLProvider style={{ height: 480 }}>
        <TabView
          defaultSelectedKey="friends"
          style={{ position: 'absolute', inset: 0 }}
        >
          <TabViewBar hideOnScroll={false}>
            <TabViewList aria-label="App">
              <TabViewTab id="friends" icon="person2" title="Friends" />
              <TabViewTab id="settings" icon="gear" title="Settings" />
            </TabViewList>
          </TabViewBar>
          <TabViewPanels>
            <TabViewPanel id="friends" shouldForceMount>
              <FriendsTab />
            </TabViewPanel>
            <TabViewPanel id="settings" shouldForceMount>
              <p style={{ padding: 24, color: 'var(--muted-foreground)' }}>
                Each tab keeps its own stack and state.
              </p>
            </TabViewPanel>
          </TabViewPanels>
        </TabView>
      </BLProvider>
    </Window>
  )
}
