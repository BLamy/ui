import { type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { Tabs, TabsAction, TabsBar, TabsFooter, TabsHeader, TabsList, TabsPanel, TabsPanels, TabsTab } from '@/components/ui/tabs'

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
    <Tabs
      variant="rail"
      defaultValue="inbox"
      style={{ height: 440, background: 'var(--background)' }}
    >
      <TabsBar>
        <TabsHeader style={{ padding: '6px 0 10px' }}>
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
        </TabsHeader>
        <TabsList aria-label="Mailboxes">
          {mailboxes.map((m) => (
            <TabsTab key={m.id} value={m.id} icon={m.icon}>
              {m.title}
            </TabsTab>
          ))}
        </TabsList>
        <TabsAction icon="compose" aria-label="New message" onClick={() => {}}>
          New
        </TabsAction>
        <TabsFooter style={{ paddingBottom: 6 }}>
          <Avatar name="Ada Lovelace" size={32} />
        </TabsFooter>
      </TabsBar>
      <TabsPanels>
        {mailboxes.map((m) => (
          <TabsPanel key={m.id} value={m.id}>
            <h3 style={{ margin: '18px 20px 10px', fontSize: 20 }}>
              {m.title}
            </h3>
            <List variant="inset">
              <ListSection>
                {m.rows.map((r, i) => (
                  <ListRow
                    key={r}
                    title={r}
                    accessory="chevron"
                    divider={i < m.rows.length - 1}
                    onClick={() => {}}
                  />
                ))}
              </ListSection>
            </List>
          </TabsPanel>
        ))}
      </TabsPanels>
    </Tabs>
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
