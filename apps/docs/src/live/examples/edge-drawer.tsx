/* EdgeDrawer page examples. Each `// #region` is shown verbatim as the example's code. */
import { useState } from 'react'
import {
  Button,
  EdgeDrawer,
  Haptics,
  Icon,
  List,
  ListRow,
  ListSection,
  Segmented,
  Slider,
  Switch,
} from '@brett_lamy/ui'
import raw from './edge-drawer.tsx?raw'
import { Window, examples } from './chrome'

// #region edgedrawer_nav
const folders = [
  { id: 'inbox', icon: 'mail', label: 'Inbox', count: 12 },
  { id: 'starred', icon: 'star', label: 'Starred', count: 0 },
  { id: 'sent', icon: 'share', label: 'Sent', count: 0 },
  { id: 'trash', icon: 'trash', label: 'Trash', count: 3 },
]

export function MailNavigation() {
  const [open, setOpen] = useState(true)
  const [folder, setFolder] = useState('inbox')
  const current = folders.find((f) => f.id === folder)!
  return (
    // The host must be positioned: the scrim and panel fill it, not the window.
    <div
      style={{
        position: 'relative',
        height: 380,
        overflow: 'hidden',
        background: 'var(--bl-bg)',
      }}
    >
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '8px 10px',
          borderBottom: '1px solid var(--bl-sep)',
        }}
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Folders"
          onPress={() => setOpen(true)}
        >
          <Icon name="sidebar" size={22} />
        </Button>
        <strong style={{ fontSize: 17 }}>{current.label}</strong>
      </header>
      <p style={{ padding: '24px 20px', color: 'var(--bl-label2)' }}>
        {current.count || 'No'} messages in {current.label}.
      </p>
      <EdgeDrawer
        side="left"
        open={open}
        onClose={() => setOpen(false)}
        width={260}
        maxWidth="84%"
      >
        <nav style={{ height: '100%', background: 'var(--bl-bg2)', paddingTop: 18 }}>
          <div style={{ padding: '0 20px 12px', fontSize: 24, fontWeight: 800 }}>
            Mailboxes
          </div>
          <List inset>
            <ListSection>
              {folders.map((f, i) => (
                <ListRow
                  key={f.id}
                  leading={
                    <Icon name={f.icon} size={20} style={{ color: 'var(--bl-tint)' }} />
                  }
                  title={f.label}
                  selected={f.id === folder}
                  divider={i < folders.length - 1}
                  trailing={
                    f.count ? (
                      <span style={{ color: 'var(--bl-label2)' }}>{f.count}</span>
                    ) : null
                  }
                  onPress={() => {
                    setFolder(f.id)
                    setOpen(false)
                  }}
                />
              ))}
            </ListSection>
          </List>
        </nav>
      </EdgeDrawer>
    </div>
  )
}
// #endregion

// #region edgedrawer_filters
const sorts = [
  { id: 'new', label: 'Newest' },
  { id: 'price', label: 'Price' },
  { id: 'rating', label: 'Rating' },
]

export function ProductFilters() {
  const [open, setOpen] = useState(true)
  const [sort, setSort] = useState('new')
  const [inStock, setInStock] = useState(true)
  const [maxPrice, setMaxPrice] = useState(120)
  return (
    <div
      style={{
        position: 'relative',
        height: 450,
        overflow: 'hidden',
        background: 'var(--bl-bg2)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px' }}>
        <strong style={{ flex: 1, fontSize: 17 }}>Headphones · 24 results</strong>
        <Button variant="secondary" size="sm" onPress={() => setOpen(true)}>
          <Icon name="sliders" size={17} /> Filters
        </Button>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          padding: '0 16px',
        }}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <div
            key={i}
            style={{
              height: 120,
              borderRadius: 12,
              background: 'var(--bl-card)',
              boxShadow: '0 0 0 1px var(--bl-sep)',
            }}
          />
        ))}
      </div>
      <EdgeDrawer
        side="right"
        open={open}
        onClose={() => setOpen(false)}
        width={300}
        maxWidth="88%"
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            background: 'var(--bl-bg2)',
          }}
        >
          <div style={{ padding: '18px 20px 10px', fontSize: 20, fontWeight: 750 }}>
            Filters
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <List inset>
              <ListSection title="Sort by">
                <div style={{ padding: 10, background: 'var(--bl-card)' }}>
                  <Segmented
                    aria-label="Sort by"
                    options={sorts}
                    value={sort}
                    onChange={setSort}
                  />
                </div>
              </ListSection>
              <ListSection title="Availability">
                <ListRow
                  title="In stock only"
                  divider={false}
                  trailing={
                    <Switch
                      aria-label="In stock only"
                      checked={inStock}
                      onChange={setInStock}
                    />
                  }
                />
              </ListSection>
              <ListSection title={`Under $${maxPrice}`}>
                <div style={{ padding: '14px 16px', background: 'var(--bl-card)' }}>
                  <Slider
                    aria-label="Maximum price"
                    minValue={20}
                    maxValue={400}
                    step={20}
                    value={maxPrice}
                    onChange={setMaxPrice}
                  />
                </div>
              </ListSection>
            </List>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 8,
              padding: 16,
              borderTop: '1px solid var(--bl-sep)',
            }}
          >
            <Button
              variant="secondary"
              style={{ flex: 1 }}
              onPress={() => {
                setSort('new')
                setInStock(true)
                setMaxPrice(120)
              }}
            >
              Reset
            </Button>
            <Button style={{ flex: 1 }} onPress={() => setOpen(false)}>
              Show results
            </Button>
          </div>
        </div>
      </EdgeDrawer>
    </div>
  )
}
// #endregion

// #region edgedrawer_glass
export function QuickSettings() {
  const [open, setOpen] = useState(true)
  const [wifi, setWifi] = useState(true)
  const [focus, setFocus] = useState(false)
  const tile = (label: string, icon: string, on: boolean, toggle: () => void) => (
    <button
      type="button"
      onClick={() => {
        Haptics.impact('light')
        toggle()
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 12,
        borderRadius: 16,
        border: 0,
        cursor: 'pointer',
        font: 'inherit',
        fontWeight: 600,
        textAlign: 'left',
        background: on ? 'var(--bl-tint)' : 'var(--bl-fill)',
        color: on ? '#fff' : 'var(--bl-label)',
      }}
    >
      <Icon name={icon} size={20} /> {label}
    </button>
  )
  return (
    <div
      style={{
        position: 'relative',
        height: 360,
        overflow: 'hidden',
        background: 'linear-gradient(135deg, #5E5CE6, #0A84FF 45%, #30B0C7)',
      }}
    >
      <div style={{ padding: 20 }}>
        <Button
          style={{ background: 'rgba(255,255,255,.92)', color: '#1C1C1E' }}
          onPress={() => setOpen(true)}
        >
          Quick settings
        </Button>
      </div>
      {/* No dimming and no panel shadow: the card inside floats with its own */}
      <EdgeDrawer
        side="right"
        open={open}
        onClose={() => setOpen(false)}
        width={284}
        scrim="transparent"
        shadow="none"
      >
        <div
          style={{
            position: 'absolute',
            inset: 12,
            padding: 16,
            borderRadius: 24,
            display: 'grid',
            gap: 10,
            alignContent: 'start',
            background: 'color-mix(in srgb, var(--bl-card) 72%, transparent)',
            backdropFilter: 'blur(24px) saturate(1.6)',
            boxShadow: open ? '0 20px 60px rgba(0,0,0,.25)' : 'none',
          }}
        >
          <strong style={{ fontSize: 17, marginBottom: 4 }}>Quick settings</strong>
          {tile('Wi-Fi', 'wifi', wifi, () => setWifi(!wifi))}
          {tile('Focus', 'moon', focus, () => setFocus(!focus))}
        </div>
      </EdgeDrawer>
    </div>
  )
}
// #endregion

export const EDGE_DRAWER_LIVE = examples(raw, [
  {
    id: 'edgedrawer_nav',
    title: 'Navigation drawer from the left',
    h: 410,
    Render: () => (
      <Window width={430}>
        <MailNavigation />
      </Window>
    ),
  },
  {
    id: 'edgedrawer_filters',
    title: 'Filters panel from the right',
    h: 430,
    Render: () => (
      <Window>
        <ProductFilters />
      </Window>
    ),
  },
  {
    id: 'edgedrawer_glass',
    title: 'Floating glass panel · custom scrim and shadow',
    h: 390,
    Render: () => (
      <Window>
        <QuickSettings />
      </Window>
    ),
  },
])
