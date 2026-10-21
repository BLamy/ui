import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Spreadsheet, type SpreadsheetSortInfo } from '@/components/ui/spreadsheet'

/** Deterministic rows (a small LCG), so every visit makes the same table. */
function makeRows(count: number) {
  let seed = 7
  const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32
  const regions = ['North', 'South', 'East', 'West', 'Central']
  const rows: string[][] = [['Order', 'Region', 'Amount', 'Latency (ms)']]
  for (let i = 0; i < count; i++) {
    rows.push([String(100000 + i), regions[(rand() * regions.length) | 0], (rand() * 2000 - 200).toFixed(2), (Math.exp(rand() * 6) | 0).toString()])
  }
  return rows
}

// Make a big table, then sort Amount or Latency: the status bar says whether the GPU or the CPU sorted it and how long
// it took. Region is text, so it always sorts on the CPU.
export default function MillionRows() {
  const [rows, setRows] = useState<string[][] | null>(null)
  const [last, setLast] = useState<SpreadsheetSortInfo | null>(null)
  return (
    <div className="flex w-full max-w-[760px] flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {[100_000, 1_000_000].map((n) => (
          <Button key={n} variant="secondary" size="sm" onPress={() => { setLast(null); setRows(makeRows(n)) }}>
            {n.toLocaleString()} rows
          </Button>
        ))}
        <span className="text-footnote text-foreground/70">
          {last ? `Last sort: ${last.rows.toLocaleString()} rows on the ${last.ranOn.toUpperCase()} in ${last.ms.toFixed(1)} ms` : rows ? 'Click a number column’s arrows to sort it' : 'Nothing is generated until you ask'}
        </span>
      </div>
      {rows ? <Spreadsheet aria-label="Orders" value={rows} onChange={setRows} onSort={setLast} className="h-[420px]" /> : null}
    </div>
  )
}
