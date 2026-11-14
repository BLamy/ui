import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs'

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

// The selected card (segmented) or underline slides to the new tab; the panel
// arrives from the side of the tab you picked (a tab to the left → content
// comes in from the left).
export default function Wallet({
  variant = 'segmented',
}: {
  variant?: string
}) {
  return (
    <div style={{ maxWidth: 380, margin: '0 auto' }}>
      <Tabs
        key={variant}
        variant={variant === 'underline' ? 'underline' : 'segmented'}
        defaultValue="tokens"
      >
        <TabsList aria-label="Wallet">
          {TABS.map((t) => (
            <TabsTab key={t.id} value={t.id}>
              {t.title}
            </TabsTab>
          ))}
        </TabsList>
        {TABS.map((t) => (
          <TabsPanel key={t.id} value={t.id}>
            <div
              style={{
                background: 'var(--card)',
                borderRadius: 14,
                overflow: 'hidden',
              }}
            >
              {t.rows.map(([a, b], i) => (
                <div
                  key={a}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    fontSize: 15,
                    boxShadow: i ? 'inset 0 1px 0 var(--border)' : undefined,
                  }}
                >
                  <span>{a}</span>
                  <span style={{ color: 'var(--muted-foreground)' }}>{b}</span>
                </div>
              ))}
            </div>
          </TabsPanel>
        ))}
      </Tabs>
    </div>
  )
}
