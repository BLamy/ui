import {
  TabView,
  TabViewBar,
  TabViewIndicator,
  TabViewList,
  TabViewPanel,
  TabViewPanels,
  TabViewTab,
} from '@brett_lamy/ui'

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
// them. TabView renders the panels after the tablist internally (react-aria
// needs the tab ids first), so the order you write doesn't matter.
export default function PanelsFirst() {
  return (
    <TabView
      placement="top"
      defaultSelectedKey="recents"
      style={{
        position: 'relative',
        height: 240,
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--bl-bg)',
        boxShadow: '0 0 0 1px var(--bl-sep)',
      }}
    >
      <TabViewPanels style={{ order: 2 }}>
        {sections.map((s) => (
          <TabViewPanel key={s.id} id={s.id}>
            <div style={{ padding: 24 }}>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 700,
                  color: 'var(--bl-label)',
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: 14,
                  color: 'var(--bl-label2)',
                  marginTop: 6,
                }}
              >
                {s.body}
              </div>
            </div>
          </TabViewPanel>
        ))}
      </TabViewPanels>
      <header
        style={{
          order: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px 0',
          boxShadow: 'inset 0 -1px 0 var(--bl-sep)',
        }}
      >
        <span
          style={{ fontSize: 15, fontWeight: 700, color: 'var(--bl-label)' }}
        >
          Address Book
        </span>
        <TabViewBar variant="plain">
          <TabViewList aria-label="Sections" style={{ gap: 4 }}>
            {sections.map((s) => (
              <TabViewTab
                key={s.id}
                id={s.id}
                textValue={s.title}
                style={{ position: 'relative', padding: '8px 12px' }}
              >
                {({ isSelected }) => (
                  <>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: isSelected
                          ? 'var(--bl-tint)'
                          : 'var(--bl-label3)',
                      }}
                    >
                      {s.title}
                    </span>
                    <TabViewIndicator />
                  </>
                )}
              </TabViewTab>
            ))}
          </TabViewList>
        </TabViewBar>
      </header>
    </TabView>
  )
}
