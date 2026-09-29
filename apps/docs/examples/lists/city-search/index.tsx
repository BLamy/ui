import { useState, type ReactNode } from 'react'
import {
  Button,
  Icon,
  List,
  ListRow,
  ListSection,
  SearchField,
} from '@brett_lamy/ui'

const cities = [
  'Amsterdam',
  'Berlin',
  'Copenhagen',
  'Dublin',
  'Lisbon',
  'Madrid',
  'Oslo',
  'Paris',
  'Prague',
  'Vienna',
]

function CitySearch() {
  const [q, setQ] = useState('')
  const hits = cities.filter((c) => c.toLowerCase().includes(q.toLowerCase()))
  return (
    <div
      style={{ height: 400, overflowY: 'auto', background: 'var(--muted)' }}
    >
      {/* `header` sticks to the top of the list; sections would stick below
          it */}
      <List
        inset
        header={
          <div style={{ padding: '10px 0' }}>
            <SearchField
              value={q}
              onChange={setQ}
              placeholder="Search cities"
            />
          </div>
        }
      >
        {hits.length ? (
          <ListSection title={`${hits.length} cities`}>
            {hits.map((c, i) => (
              <ListRow
                key={c}
                title={c}
                leading={<Icon name="pin" size={20} />}
                divider={i < hits.length - 1}
                onPress={() => {}}
              />
            ))}
          </ListSection>
        ) : (
          <div style={{ padding: '56px 24px', textAlign: 'center' }}>
            <Icon
              name="search"
              size={40}
              style={{ margin: '0 auto', color: 'var(--tertiary-foreground)' }}
            />
            <div style={{ fontSize: 19, fontWeight: 700, marginTop: 12 }}>
              No Results
            </div>
            <div
              style={{ fontSize: 14, color: 'var(--muted-foreground)', marginTop: 4 }}
            >
              Nothing matches “{q}”.
            </div>
            <Button
              variant="secondary"
              size="sm"
              style={{ marginTop: 14 }}
              onPress={() => setQ('')}
            >
              Clear search
            </Button>
          </div>
        )}
      </List>
    </div>
  )
}

// A rounded, hairline-bordered window the example sits in; `width` caps it,
// centered.
function Window({
  width,
  bg = 'var(--background)',
  children,
}: {
  width?: number
  bg?: string
  children?: ReactNode
}) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: bg,
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function Cities() {
  return (
    <Window width={430} bg="var(--muted)">
      <CitySearch />
    </Window>
  )
}
