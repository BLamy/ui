import { ReplayPreview, replayDemoEvents } from '@/components/ui/replay-preview'

// DevTools open on the Network tab just after checkout failed: 8 requests, 1 failed in red. Select a row for its
// headers, payload and response, switch to Console for the error, or scrub back to watch both lists shrink.
export default function Devtools() {
  return (
    <div style={{ width: '100%', maxWidth: 760 }}>
      <ReplayPreview events={replayDemoEvents} initialTime={8000} defaultDevtoolsTab="network" />
    </div>
  )
}
