import { DataTable, type DataTableColumn } from '@/components/ui/data-table'
import { EmptyState } from '@/components/ui/empty-state'
import { Icon } from '@/lib/icon'

interface Invoice { id: string; number: string; customer: string; total: number }

const COLUMNS: DataTableColumn<Invoice>[] = [
  { id: 'number', header: 'Invoice', width: 96 },
  { id: 'customer', header: 'Customer', flex: 2, minWidth: 140 },
  { id: 'total', header: 'Total', width: 96, align: 'end' },
]

// No rows: the header stays, and the empty state (a status region beside the grid, not in it) says why.
export default function Empty() {
  return (
    <DataTable
      aria-label="Invoices"
      rows={[]}
      columns={COLUMNS}
      className="h-[260px]"
      emptyState={<EmptyState size="sm" icon={<Icon name="tray" />} title="No invoices yet" description="Invoices you send show up here." />}
    />
  )
}
