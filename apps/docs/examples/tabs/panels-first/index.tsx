import { Tabs, TabsBar, TabsIndicator, TabsList, TabsPanel, TabsPanels, TabsTab } from '@/components/ui/tabs'

const sections = [
  { id: 'contacts', title: 'Contacts', body: 'Everyone you know, A to Z.' },
  {
    id: 'recents',
    title: 'Recents',
    body: 'Calls and messages from the last week.',
  },
  { id: 'favorites', title: 'Favorites', body: 'The people you reach most.' },
]

// The panels are written first and the bar is nested inside a header after
// them. Tabs and panels find each other wherever they sit, so the order you
// write doesn't matter; here the header is laid out above the panels by hand.
export default function PanelsFirst() {
  return (
    <Tabs
      variant="plain"
      defaultValue="recents"
      style={{
        position: 'relative',
        height: 240,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--background)',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      <TabsPanels style={{ order: 2 }}>
        {sections.map((s) => (
          <TabsPanel key={s.id} value={s.id}>
            <div style={{ padding: 24 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--foreground)',
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--muted-foreground)',
                  marginTop: 6,
                }}
              >
                {s.body}
              </div>
            </div>
          </TabsPanel>
        ))}
      </TabsPanels>
      <header
        style={{
          order: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px 0',
          boxShadow: 'inset 0 -1px 0 var(--border)',
        }}
      >
        <span
          style={{ fontSize: 15, fontWeight: 700, color: 'var(--foreground)' }}
        >
          Address Book
        </span>
        <TabsBar>
          <TabsList aria-label="Sections" style={{ gap: 4 }}>
            {sections.map((s) => (
              <TabsTab
                key={s.id}
                value={s.id}
                style={{ position: 'relative', padding: '8px 12px' }}
              >
                {({ selected }) => (
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: selected
                        ? 'var(--primary)'
                        : 'var(--tertiary-foreground)',
                    }}
                  >
                    {s.title}
                  </span>
                )}
              </TabsTab>
            ))}
            <TabsIndicator />
          </TabsList>
        </TabsBar>
      </header>
    </Tabs>
  )
}
