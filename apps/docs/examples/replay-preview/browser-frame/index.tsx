import { ReplayPreview, replayDemoEvents } from '@brett_lamy/ui'

// The browser frame, paused just before checkout fails. Press play (or Space),
// scrub, press a marker on the rail to jump to it, change speed with the 1×
// button (or < >), F for full screen.
export default function BrowserFrame() {
  return (
    <div style={{ width: '100%', maxWidth: 760 }}>
      <ReplayPreview events={replayDemoEvents} initialTime={6400} />
    </div>
  )
}
