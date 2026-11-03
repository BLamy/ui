import { useCallback, useState } from 'react'
import { RequestLink, RequestTable } from '@/components/ui/request-table'
import type { RowId } from '@/lib/log-list'
import type { RequestRow } from '@/lib/request-table'

type Row = RequestRow & { other: RowId; otherLabel: string }

const CALLS = [
  { fn: 'getSession', at: 40, took: 72, status: 200 },
  { fn: 'getCart', at: 180, took: 140, status: 200 },
  { fn: 'listProducts', at: 460, took: 310, status: 200 },
  { fn: 'addToCart', at: 2140, took: 96, status: 200 },
  { fn: 'checkout', at: 4300, took: 880, status: 500 },
]

// The browser's requests and the server functions that answered them.
const ROWS: Row[] = CALLS.flatMap((call, i): Row[] => [
  { id: `browser-${i}`, url: `https://shop.example.com/_serverFn/${call.fn}`, method: 'POST', status: call.status, type: 'fetch', time: call.at, duration: call.took, tone: 'primary', other: `server-${i}`, otherLabel: 'Server function' },
  { id: `server-${i}`, url: `server:${call.fn}`, name: `${call.fn}()`, method: 'FN', status: call.status, type: 'function', time: call.at + 14, duration: call.took - 28, tone: 'accent', other: `browser-${i}`, otherLabel: 'Browser call' },
])

const COLUMNS = ['name', 'method', 'status', 'duration', 'waterfall'] as const

// A row's link selects the other end of its call, which comes into view if it isn't already.
export default function Pair() {
  const [selected, setSelected] = useState<RowId | null>('browser-4')
  const renderLink = useCallback((row: Row) => <RequestLink onPress={() => setSelected(row.other)}>{row.otherLabel}</RequestLink>, [])
  return (
    <RequestTable<Row>
      aria-label="Requests and server functions"
      rows={ROWS}
      columns={COLUMNS}
      selectedId={selected}
      onSelectionChange={setSelected}
      renderLink={renderLink}
      className="h-[320px] w-full"
    />
  )
}
