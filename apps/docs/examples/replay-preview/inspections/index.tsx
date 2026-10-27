import { ReplayPreview, replayDemoEvents, type ReplayInspection } from '@/components/ui/replay-preview'

// What a debugger looked at, and when. Press play: at 0:06.8 DevTools opens on the
// promo request, at 0:07.0 on the deprecation warning, at 0:07.6 on the checkout
// that answered 500. Each is also a checkpoint on the rail.
const inspections: ReplayInspection[] = [
  { time: 6800, request: '/api/promo/validate?code=FALL25', label: 'FALL25 validates' },
  { time: 7000, message: 'is deprecated', label: 'The promo call sends a deprecated field' },
  { time: 7600, request: '/api/checkout', label: 'Checkout answers 500' },
]

export default function Inspections() {
  return (
    <div style={{ width: '100%', maxWidth: 760 }}>
      <ReplayPreview events={replayDemoEvents} initialTime={6000} inspections={inspections} />
    </div>
  )
}
