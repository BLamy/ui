import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { List, ListRow, ListSection } from '@/components/ui/list'
import { SearchInput } from '@/components/ui/search-input'
import { Icon } from '@/lib/icon'

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
      {/* With no rows, the list shows its `emptyState` instead of the section. */}
      <List
        variant="inset"
        emptyState={
          <EmptyState
            icon={<Icon name="magnifyingglass" />}
            title="No Results"
            description={`Nothing matches “${q}”.`}
            action={
              <Button variant="secondary" size="sm" onClick={() => setQ('')}>
                Clear search
              </Button>
            }
            className="h-auto py-14"
          />
        }
        header={
          <div style={{ padding: '10px 0' }}>
            <SearchInput
              value={q}
              onValueChange={setQ}
              placeholder="Search cities"
            />
          </div>
        }
      >
        <ListSection title={`${hits.length} cities`}>
          {hits.map((c, i) => (
            <ListRow
              key={c}
              title={c}
              icon={<Icon name="pin" size={20} />}
              divider={i < hits.length - 1}
              onClick={() => {}}
            />
          ))}
        </ListSection>
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
