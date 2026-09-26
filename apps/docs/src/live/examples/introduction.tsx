/* Introduction page examples. Each `// #region` is shown verbatim as the example's code. */
import { useState } from 'react'
import {
  Avatar,
  BLProvider,
  Credenza,
  Button,
  List,
  ListRow,
  ListSection,
  NavigationStack,
  TabView,
  TabViewBar,
  TabViewList,
  TabViewPanel,
  TabViewPanels,
  TabViewTab,
  type Screen,
} from '@brett_lamy/ui'
import raw from './introduction.tsx?raw'
import { Window, examples } from './chrome'

// #region intro_app
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
        <p style={{ margin: 0, padding: '4px 20px 24px', color: 'var(--bl-label2)' }}>
          {open?.f} will get a notification.
        </p>
      </Credenza>
    </>
  )
}

// Containers own behavior, your state owns data: a tab bar, a stack per tab, lists and a tray.
export function FirstApp() {
  return (
    <BLProvider style={{ height: 480 }}>
      <TabView defaultSelectedKey="friends" style={{ position: 'absolute', inset: 0 }}>
        <TabViewBar hideOnScroll={false}>
          <TabViewList aria-label="App">
            <TabViewTab id="friends" icon="person2" title="Friends" />
            <TabViewTab id="settings" icon="gear" title="Settings" />
          </TabViewList>
        </TabViewBar>
        <TabViewPanels>
          <TabViewPanel id="friends">
            <FriendsTab />
          </TabViewPanel>
          <TabViewPanel id="settings">
            <p style={{ padding: 24, color: 'var(--bl-label2)' }}>
              Each tab keeps its own stack and state.
            </p>
          </TabViewPanel>
        </TabViewPanels>
      </TabView>
    </BLProvider>
  )
}
// #endregion

export const INTRODUCTION_LIVE = examples(raw, [
  {
    id: 'intro_app',
    title: 'A first app · tabs, a stack, lists, a tray',
    h: 510,
    Render: () => (
      <Window width={390}>
        <FirstApp />
      </Window>
    ),
  },
])
