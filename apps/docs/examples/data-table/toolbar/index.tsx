import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { SearchInput } from '@/components/ui/search-input'

interface Order { id: string; number: number; customer: string; city: string; items: number; total: number; status: 'Paid' | 'Refunded' | 'Pending' }

const NAMES = ['Ada Lovelace', 'Grace Hopper', 'Alan Turing', 'Katherine Johnson', 'Edsger Dijkstra', 'Barbara Liskov', 'Donald Knuth', 'Margaret Hamilton']
const CITIES = ['London', 'New York', 'Manchester', 'Hampton', 'Amsterdam', 'Boston', 'Stanford', 'Paoli']
const STATUSES: Order['status'][] = ['Paid', 'Paid', 'Pending', 'Paid', 'Refunded']

const ORDERS: Order[] = Array.from({ length: 60 }, (_, i) => ({
  id: `order-${i}`,
  number: 10_400 + i,
  customer: NAMES[(i * 5) % NAMES.length],
  city: CITIES[(i * 5) % CITIES.length],
  items: 1 + ((i * 7) % 6),
  total: Math.round(1200 + ((i * 7919) % 23000)) / 100,
  status: STATUSES[i % STATUSES.length],
}))

const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

// Columns are data: keep them out of the render (or in a useMemo), so the rows only render again when they change.
const COLUMNS: DataTableColumn<Order>[] = [
  { id: 'number', header: 'Order', width: 84, cell: (o) => `#${o.number}`, sortValue: (o) => o.number, className: 'text-muted-foreground tabular-nums' },
  { id: 'customer', header: 'Customer', flex: 2, minWidth: 140 },
  { id: 'city', header: 'City', flex: 1, minWidth: 100, hideBelow: 'regular' },
  { id: 'status', header: 'Status', width: 96, cell: (o) => <Badge size="sm" variant={o.status === 'Paid' ? 'success' : o.status === 'Pending' ? 'warning' : 'secondary'}>{o.status}</Badge>, sortValue: (o) => o.status },
  { id: 'items', header: 'Items', width: 64, align: 'end' },
  { id: 'total', header: 'Total', width: 96, align: 'end', cell: (o) => money.format(o.total), sortValue: (o) => o.total },
]

// A filter in the `toolbar`, rows that press (`mode="none"` + `onAction`), and the empty state a filter
// with no matches gets.
export default function Toolbar() {
  const [query, setQuery] = useState('')
  const [opened, setOpened] = useState<string | null>(null)
  const rows = useMemo(() => ORDERS.filter((o) => o.customer.toLowerCase().includes(query.toLowerCase())), [query])
  return (
    <DataTable
      aria-label="Orders"
      rows={rows}
      columns={COLUMNS}
      density="compact"
      mode="none"
      onAction={(_id, { row }) => setOpened(`#${row.number}`)}
      className="h-[360px]"
      toolbar={(
        <>
          <SearchInput aria-label="Filter by customer" placeholder="Customer" size="sm" value={query} onValueChange={setQuery} className="max-w-56" />
          <span className="ms-auto text-footnote text-muted-foreground" role="status">{opened ? `Opened ${opened}` : `${rows.length} orders`}</span>
        </>
      )}
      emptyState={<EmptyState size="sm" title="No matches" description={`No customer has “${query}” in their name.`} />}
    />
  )
}
