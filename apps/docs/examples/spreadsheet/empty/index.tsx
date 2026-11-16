import { useState } from 'react'
import { Spreadsheet } from '@/components/ui/spreadsheet'

// Titles and no rows: the empty state says to paste cells or add one (Add Row, in the status bar).
export default function Empty() {
  const [rows, setRows] = useState<string[][]>([['Part', 'Supplier', 'Stock', 'Unit price']])
  return <Spreadsheet aria-label="Parts" value={rows} onValueChange={setRows} className="h-[260px] w-full max-w-[720px]" />
}
