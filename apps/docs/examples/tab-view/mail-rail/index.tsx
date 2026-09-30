import { type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { TabView, TabViewAction, TabViewBar, TabViewFooter, TabViewHeader, TabViewList, TabViewPanel, TabViewPanels, TabViewTab } from '@/components/ui/tab-view'

const mailboxes = [
  {
    id: 'inbox',
    icon: 'mail',
    title: 'Inbox',
    rows: ['Quarterly numbers', 'Offsite agenda', 'Welcome aboard'],
  },
  {
    id: 'chats',
    icon: 'message',
    title: 'Chats',
    rows: ['#design', '#launch', 'Priya Raman'],
  },
  {
    id: 'starred',
    icon: 'star',
    title: 'Starred',
    rows: ['Brand guidelines v4'],
  },
  {
    id: 'alerts',
    icon: 'bell',
    title: 'Alerts',
    rows: ['Build passed on main', 'New sign-in from Safari'],
  },
]

function MailRail() {
  return (
    <TabView
      orientation="vertical"
      defaultSelectedKey="inbox"
      style={{ height: 440, background: 'var(--background)' }}
    >
      <TabViewBar>
        <TabViewHeader style={{ padding: '6px 0 10px' }}>
          <span
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 36,
              height: 36,
              borderRadius: 10,
              background: 'var(--primary)',
              color: '#fff',
              fontWeight: 800,
            }}
          >
            M
          </span>
        </TabViewHeader>
        <TabViewList aria-label="Mailboxes">
          {mailboxes.map((m) => (
            <TabViewTab key={m.id} id={m.id} icon={m.icon} title={m.title} />
          ))}
        </TabViewList>
        <TabViewAction
          icon="compose"
          title="New"
          aria-label="New message"
          onPress={() => {}}
        />
        <TabViewFooter style={{ paddingBottom: 6 }}>
          <Avatar c={{ f: 'Ada', l: 'Lovelace' }} size={32} />
        </TabViewFooter>
      </TabViewBar>
      <TabViewPanels>
        {mailboxes.map((m) => (
          <TabViewPanel key={m.id} id={m.id}>
            <h3 style={{ margin: '18px 20px 10px', fontSize: 20 }}>
              {m.title}
            </h3>
            <List inset>
              <ListSection>
                {m.rows.map((r, i) => (
                  <ListRow
                    key={r}
                    title={r}
                    accessory="chevron"
                    divider={i < m.rows.length - 1}
                    onPress={() => {}}
                  />
                ))}
              </ListSection>
            </List>
          </TabViewPanel>
        ))}
      </TabViewPanels>
    </TabView>
  )
}

/** The rounded, hairline-bordered window the example sits in. */
function Window({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
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

export default function MailRailExample() {
  return (
    <Window>
      <MailRail />
    </Window>
  )
}
