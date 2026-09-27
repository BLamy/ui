import { Tab, TabList, TabPanel, Tabs } from '@brett_lamy/ui'

const TABS = [
  {
    id: 'tokens',
    title: 'Tokens',
    rows: [
      ['ETH', '$2,480.00'],
      ['USDC', '$1,120.50'],
      ['OP', '$96.12'],
    ],
  },
  {
    id: 'collectibles',
    title: 'Collectibles',
    rows: [
      ['Sequin #214', '0.42 ETH'],
      ['Tumble #9', '0.08 ETH'],
    ],
  },
  {
    id: 'activity',
    title: 'Activity',
    rows: [
      ['Sent to Wei', '−$120.00'],
      ['Received', '+$48.10'],
      ['Swapped', 'ETH → USDC'],
      ['Backed up', 'Today'],
    ],
  },
]

// The selected card (segmented) or underline slides to the new tab; the panel arrives from
// the side of the tab you picked (a tab to the left → content comes in from the left).
export default function Wallet({ variant = 'segmented' }: { variant?: string }) {
  return (
    <div style={{ maxWidth: 380, margin: '0 auto' }}>
      <Tabs
        key={variant}
        variant={variant === 'underline' ? 'underline' : 'segmented'}
        defaultSelectedKey="tokens"
      >
        <TabList aria-label="Wallet">
          {TABS.map((t) => (
            <Tab key={t.id} id={t.id}>
              {t.title}
            </Tab>
          ))}
        </TabList>
        {TABS.map((t) => (
          <TabPanel key={t.id} id={t.id}>
            <div style={{ background: 'var(--bl-card)', borderRadius: 14, overflow: 'hidden' }}>
              {t.rows.map(([a, b], i) => (
                <div
                  key={a}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    fontSize: 15,
                    boxShadow: i ? 'inset 0 1px 0 var(--bl-sep)' : undefined,
                  }}
                >
                  <span>{a}</span>
                  <span style={{ color: 'var(--bl-label2)' }}>{b}</span>
                </div>
              ))}
            </div>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  )
}
