import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { Slider } from '@/components/ui/slider'

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

// The table's own width decides, not the window's: under 760 px the City column (`hideBelow: 'regular'`) goes, and
// under 480 px the rows stack, the first column's cell over the others', with sorting in a menu.
export default function Narrow() {
  const [width, setWidth] = useState(420)
  return (
    <div className="flex w-full flex-col gap-2">
      <Slider<number> aria-label="Table width" size="sm" className="w-full max-w-sm" min={300} max={900} value={width} onValueChange={(value) => setWidth(value)} />
      <DataTable aria-label="Orders" rows={ORDERS} columns={COLUMNS} className="h-[360px] max-w-full" style={{ width }} />
    </div>
  )
}
