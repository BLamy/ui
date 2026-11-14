import { useState, type ReactNode } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { Tabs, TabsBar, TabsFooter, TabsIndicator, TabsList, TabsPanel, TabsPanels, TabsTab } from '@/components/ui/tabs'

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
    <Tabs
      variant="plain"
      value={tab}
      onValueChange={(next) => {
        if (next) setTab(next)
      }}
      style={{ height: 360, background: 'var(--card)' }}
    >
      <TabsBar
        style={{
          alignItems: 'center',
          padding: '0 10px',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <TabsList aria-label="Inbox">
          {inboxTabs.map((t) => (
            <TabsTab
              key={t.id}
              value={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '13px 12px 12px',
                fontSize: 14.5,
                fontWeight: 600,
              }}
            >
              {({ selected }) => (
                <>
                  <span
                    style={{
                      color: selected
                        ? 'var(--foreground)'
                        : 'var(--muted-foreground)',
                    }}
                  >
                    {t.label}
                  </span>
                  {t.count ? (
                    <Badge variant={selected ? 'default' : 'secondary'}>
                      {t.count}
                    </Badge>
                  ) : null}
                </>
              )}
            </TabsTab>
          ))}
          <TabsIndicator />
        </TabsList>
        <TabsFooter>
          <Button size="sm" variant="ghost">
            Mark all read
          </Button>
        </TabsFooter>
      </TabsBar>
      <TabsPanels>
        {inboxTabs.map((t) => (
          <TabsPanel key={t.id} value={t.id}>
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
                      icon={<Avatar name={`${m.f} ${m.l}`} size={36} />}
                      title={m.subject}
                      description={`${m.f} · ${m.preview}`}
                      onClick={() => {}}
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

export default function InboxBadges() {
  return (
    <Window>
      <InboxTabs />
    </Window>
  )
}
