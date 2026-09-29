import { useState, type ReactNode } from 'react'
import {
  Button,
  EdgeDrawer,
  Icon,
  List,
  ListRow,
  ListSection,
  Segmented,
  Slider,
  Switch,
} from '@brett_lamy/ui'

const sorts = [
  { id: 'new', label: 'Newest' },
  { id: 'price', label: 'Price' },
  { id: 'rating', label: 'Rating' },
]

function ProductFilters() {
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
        background: 'var(--muted)',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '14px 16px' }}
      >
        <strong style={{ flex: 1, fontSize: 17 }}>
          Headphones · 24 results
        </strong>
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
              background: 'var(--card)',
              boxShadow: '0 0 0 1px var(--border)',
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
            background: 'var(--muted)',
          }}
        >
          <div
            style={{ padding: '18px 20px 10px', fontSize: 20, fontWeight: 750 }}
          >
            Filters
          </div>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <List inset>
              <ListSection title="Sort by">
                <div style={{ padding: 10, background: 'var(--card)' }}>
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
                <div
                  style={{ padding: '14px 16px', background: 'var(--card)' }}
                >
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
              borderTop: '1px solid var(--border)',
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

export default function ProductFiltersExample() {
  return (
    <Window>
      <ProductFilters />
    </Window>
  )
}
