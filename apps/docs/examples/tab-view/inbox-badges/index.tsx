import { useState, type ReactNode } from 'react'
import {
  Avatar,
  Badge,
  Button,
  List,
  ListRow,
  ListSection,
  TabView,
  TabViewBar,
  TabViewFooter,
  TabViewIndicator,
  TabViewList,
  TabViewPanel,
  TabViewPanels,
  TabViewTab,
} from '@brett_lamy/ui'

const inboxTabs = [
  { id: 'all', label: 'All', count: 0 },
  { id: 'unread', label: 'Unread', count: 7 },
  { id: 'mentions', label: 'Mentions', count: 2 },
]
const threads = [
  {
    f: 'Nadia',
    l: 'Brooks',
    subject: 'Launch checklist',
    preview: 'Two items left before we ship…',
    unread: true,
  },
  {
    f: 'Tom',
    l: 'Reyes',
    subject: 'Re: onboarding copy',
    preview: '@you can you take a pass?',
    unread: true,
  },
  {
    f: 'Ellen',
    l: 'Park',
    subject: 'Design review',
    preview: 'Moved to Thursday at 2pm.',
    unread: false,
  },
]

function InboxTabs() {
  const [tab, setTab] = useState('unread')
  return (
    <TabView
      placement="top"
      selectedKey={tab}
      onSelectionChange={(k) => setTab(String(k))}
      style={{ height: 360, background: 'var(--card)' }}
    >
      <TabViewBar
        variant="plain"
        style={{
          alignItems: 'center',
          padding: '0 10px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <TabViewList aria-label="Inbox">
          {inboxTabs.map((t) => (
            <TabViewTab
              key={t.id}
              id={t.id}
              textValue={t.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '13px 12px 12px',
                fontSize: 14.5,
                fontWeight: 600,
              }}
            >
              {({ isSelected }) => (
                <>
                  <span
                    style={{
                      color: isSelected
                        ? 'var(--foreground)'
                        : 'var(--muted-foreground)',
                    }}
                  >
                    {t.label}
                  </span>
                  {t.count ? (
                    <Badge variant={isSelected ? 'default' : 'secondary'}>
                      {t.count}
                    </Badge>
                  ) : null}
                  <TabViewIndicator />
                </>
              )}
            </TabViewTab>
          ))}
        </TabViewList>
        <TabViewFooter>
          <Button size="sm" variant="ghost">
            Mark all read
          </Button>
        </TabViewFooter>
      </TabViewBar>
      <TabViewPanels>
        {inboxTabs.map((t) => (
          <TabViewPanel key={t.id} id={t.id}>
            <List>
              <ListSection>
                {threads
                  .filter(
                    (m) =>
                      t.id === 'all' ||
                      (t.id === 'unread' ? m.unread : m.preview.includes('@')),
                  )
                  .map((m) => (
                    <ListRow
                      key={m.subject}
                      leading={<Avatar c={m} size={36} />}
                      title={m.subject}
                      subtitle={`${m.f} · ${m.preview}`}
                      onPress={() => {}}
                      trailing={
                        m.unread ? (
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: 9,
                              background: 'var(--primary)',
                            }}
                          />
                        ) : null
                      }
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

export default function InboxBadges() {
  return (
    <Window>
      <InboxTabs />
    </Window>
  )
}
