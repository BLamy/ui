import { ReplayPreview, replayDemoEvents } from '@/components/ui/replay-preview'

// The scrubber highlights 0:06.2–0:08.0, where checkout fails. Play stops at the
// segment's end (play again to replay it); scrub outside it to play the rest.
export default function TimeWindow() {
  return (
    <div style={{ width: '100%', maxWidth: 760 }}>
      <ReplayPreview events={replayDemoEvents} timeWindow={[6200, 8000]} />
    </div>
  )
}
