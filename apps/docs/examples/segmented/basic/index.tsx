import { useState } from 'react'
import { Segmented, SegmentedItem } from '@/components/ui/segmented'

const ranges = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]

const totals: Record<string, { value: string; note: string }> = {
  day: { value: '1,284', note: 'visits today' },
  week: { value: '9,310', note: 'visits this week' },
  month: { value: '38,902', note: 'visits this month' },
  year: { value: '412,077', note: 'visits this year' },
}

// Controlled: `value` is the checked item's value, `onValueChange` gets the new one.
// Arrow keys move and select, like a radio group, and the selected card slides.
export default function Basic() {
  const [range, setRange] = useState('week')
  const t = totals[range]
  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <Segmented aria-label="Time range" value={range} onValueChange={(v: string | null) => v && setRange(v)}>
        {ranges.map((r) => (
          <SegmentedItem key={r.id} value={r.id}>
            {r.label}
          </SegmentedItem>
        ))}
      </Segmented>
      <div className="rounded-card bg-card p-5 text-center">
        <div className="text-title font-bold tabular-nums">{t.value}</div>
        <div className="text-subhead text-muted-foreground">{t.note}</div>
      </div>
    </div>
  )
}
