import { useState } from 'react'
import { Spreadsheet } from '@/components/ui/spreadsheet'
import { parseCsv } from '@/lib/csv'

const CSV = `Part,Supplier,Stock,Unit price,Restocked
M3 heat-set insert,Ruthex,1840,0.06,2026-09-14
PETG filament (1 kg),Prusament,12,29.99,2026-10-02
Nozzle 0.4 mm,E3D,46,12.50,2026-08-21
PEI sheet,Prusa,7,39.00,2026-07-30
M3 × 8 screw,Bossard,3200,0.04,2026-09-14
Bowden tube (1 m),Capricorn,18,9.90,2026-06-11
Thermistor,Semitec,25,7.25,2026-10-12
Part cooling fan,Delta,14,6.80,2026-05-03
`

// A small table: double-click or type to edit, drag to select (the sum shows below), click a column's arrows to sort.
export default function Basic() {
  const [rows, setRows] = useState(() => parseCsv(CSV).rows)
  return <Spreadsheet aria-label="Parts" value={rows} onChange={setRows} className="h-[340px] w-full max-w-[720px]" />
}
