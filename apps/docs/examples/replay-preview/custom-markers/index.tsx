import { useState } from 'react'
import { ReplayPreview, replayDemoEvents, type ReplayMarker } from '@/components/ui/replay-preview'

// Your own moments on the rail — findings from an agent, test assertions —
// instead of the recorded ones. `onMarkerPress` tells you which was chosen.
const findings: ReplayMarker[] = [
  { id: 'f1', kind: 'custom', time: 3450, label: 'Second item added', detail: 'cart badge → 2' },
  { id: 'f2', kind: 'network', time: 7440, label: 'POST /api/checkout', detail: '500 after 912 ms' },
  { id: 'f3', kind: 'error', time: 8350, label: 'TypeError in applyPromo', detail: 'checkout.ts:88' },
]

export default function CustomMarkers() {
  const [picked, setPicked] = useState<ReplayMarker | null>(null)
  return (
    <div style={{ display: 'grid', gap: 10, width: '100%', maxWidth: 760 }}>
      <ReplayPreview
        events={replayDemoEvents}
        markers={findings}
        url="https://shop.northwind.test/checkout"
        trafficLights={false}
        initialTime={3450}
        onMarkerPress={setPicked}
      />
      <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
        {picked ? `${picked.label} — ${picked.detail}` : 'Press a marker on the rail.'}
      </div>
    </div>
  )
}
