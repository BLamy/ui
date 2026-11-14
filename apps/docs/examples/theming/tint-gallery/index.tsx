import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Segmented, SegmentedItem } from '@/components/ui/segmented'
import { Switch } from '@/components/ui/switch'
import { BLProvider } from '@/lib/theme'

const accents = [
  { name: 'Blue', tint: '#0A84FF' },
  { name: 'Indigo', tint: '#5E5CE6' },
  { name: 'Green', tint: '#34C759' },
  { name: 'Pink', tint: '#FF375F' },
]

function Sample({ name }: { name: string }) {
  const [on, setOn] = useState(true)
  const [plan, setPlan] = useState('pro')
  return (
    <div style={{ display: 'grid', gap: 12, padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <strong style={{ flex: 1 }}>{name}</strong>
        <Badge variant="tinted">New</Badge>
      </div>
      <Segmented
        aria-label="Plan"
        value={plan}
        onValueChange={(v) => v && setPlan(v)}
      >
        <SegmentedItem value="free">Free</SegmentedItem>
        <SegmentedItem value="pro">Pro</SegmentedItem>
      </Segmented>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span style={{ fontSize: 14 }}>Sync</span>
        <Switch aria-label="Sync" checked={on} onCheckedChange={setOn} />
      </div>
      <Button size="sm">Upgrade</Button>
    </div>
  )
}

export default function TintGallery() {
  // One tint prop re-accents everything below it; appearance follows the host.
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: 12,
      }}
    >
      {accents.map((a) => (
        <BLProvider
          key={a.name}
          tint={a.tint}
          style={{
            height: 'auto',
            borderRadius: 14,
            boxShadow: '0 0 0 1px var(--border)',
          }}
        >
          <Sample name={a.name} />
        </BLProvider>
      ))}
    </div>
  )
}
