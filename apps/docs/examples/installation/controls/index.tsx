import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { Segmented } from '@/components/ui/segmented'
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
    <div
      style={{
        display: 'grid',
        gap: 16,
        justifyItems: 'center',
        maxWidth: 420,
        margin: '0 auto',
      }}
    >
      <div style={{ width: 280 }}>
        <Segmented
          aria-label="Range"
          value={range}
          onChange={setRange}
          options={ranges}
        />
      </div>
      <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
        <Avatar c={{ f: 'Ada', l: 'Lovelace' }} size={40} />
        <Switch aria-label="Demo switch" checked={on} onChange={setOn} />
        <Spinner />
      </div>
      <div style={{ fontSize: 12.5, color: 'var(--muted-foreground)' }}>
        @brett_lamy/ui is live.
      </div>
    </div>
  )
}
