import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Segmented, SegmentedItem } from '@/components/ui/segmented'
import { Spinner } from '@/components/ui/spinner'
import { Switch } from '@/components/ui/switch'

const ranges = [
  { id: 'day', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
]

export default function Controls() {
  const [range, setRange] = useState('day')
  const [on, setOn] = useState(true)
  return (
    <div className="mx-auto grid max-w-md justify-items-center gap-4">
      <div className="w-70">
        <Segmented aria-label="Range" value={range} onValueChange={(v) => v && setRange(v)}>
          {ranges.map((r) => (
            <SegmentedItem key={r.id} value={r.id}>
              {r.label}
            </SegmentedItem>
          ))}
        </Segmented>
      </div>
      <div className="flex items-center gap-4.5">
        <Avatar name="Ada Lovelace" size={40} />
        <Switch aria-label="Demo switch" checked={on} onCheckedChange={setOn} />
        <Spinner />
      </div>
      <div className="text-footnote text-muted-foreground">@brett_lamy/ui is live.</div>
    </div>
  )
}
