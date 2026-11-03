import { useState } from 'react'
import { LogList } from '@/components/ui/log-list'
import { Segmented } from '@/components/ui/segmented'
import type { LogRow } from '@/lib/log-list'

const TRACE = ['at readPrice (cart.tsx:118:24)', 'at CartRow (cart.tsx:96:12)', 'at renderWithHooks (react-dom.js:15486:18)'].join('\n')
const LONG = '{ id: 812, sku: "A-812", qty: 2, price: 47.99, tags: ["sale", "new"], warehouse: "ams-1", reserved: false, note: "held for the customer until the payment has gone through" }'

const ROWS: LogRow[] = Array.from({ length: 120 }, (_, i) => ({
  id: i,
  time: i * 211,
  source: i % 7 === 3 ? 'cart.tsx:118' : 'app.tsx:42',
  ...(i % 7 === 3
    ? { level: 'error', message: "TypeError: Cannot read properties of undefined (reading 'price')", detail: TRACE }
    : i % 3 === 1
      ? { level: 'log', message: LONG }
      : { level: i % 5 === 0 ? 'warn' : 'log', message: `Rendered <CartPage> in ${4 + (i % 19)} ms`, count: i % 11 === 0 ? 3 + (i % 5) : undefined }),
}))

// Wrap shows every message whole. Cut gives each one line, and a press opens it; a chevron marks what has more to show.
// Either way a row's trace opens from its chevron, and rows above and below keep their places as heights change.
export default function OpenRows() {
  const [overflow, setOverflow] = useState<'wrap' | 'expand'>('wrap')
  return (
    <div className="flex h-[420px] w-full flex-col gap-2">
      <Segmented aria-label="Long messages" className="self-start" value={overflow} onChange={(id) => setOverflow(id as 'wrap' | 'expand')}
        options={[{ id: 'wrap', label: 'Wrap' }, { id: 'expand', label: 'Cut' }]} />
      <LogList aria-label="Console" rows={ROWS} overflow={overflow} className="min-h-0 flex-1" />
    </div>
  )
}
