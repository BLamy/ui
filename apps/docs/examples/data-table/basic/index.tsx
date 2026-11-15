import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn, type DataTableSort } from '@/components/ui/data-table'
import type { RowId } from '@/lib/log-list-model'

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

// Press a header to sort (ascending, descending, off), drag its edge to resize, press a row to select it. The arrow keys
// do the same: ↑ from the first row reaches the headers.
export default function Basic() {
  const [selected, setSelected] = useState<RowId | null>('order-3')
  const [sort, setSort] = useState<DataTableSort | null>({ column: 'total', direction: 'descending' })
  return (
    <DataTable
      aria-label="Orders"
      rows={ORDERS}
      columns={COLUMNS}
      value={selected}
      onValueChange={setSelected}
      sort={sort}
      onSortChange={setSort}
      className="h-[360px]"
    />
  )
}
