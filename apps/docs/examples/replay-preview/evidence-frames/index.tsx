import { ReplayPreview, formatReplayTime, replayDemoEvents } from '@/components/ui/replay-preview'

// `chrome="none"` and `controls={false}` turn the player into a still frame
// of the recording at `initialTime` — screenshot evidence that is the page
// itself, pointer and click ripple included. Frames mount as they scroll in.
const frames = [
  { at: 2250, label: 'Adds Trail Runner 2' },
  { at: 5600, label: 'Types the promo code' },
  { at: 8350, label: 'Checkout fails' },
]

export default function EvidenceFrames() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        width: '100%',
        maxWidth: 820,
      }}
    >
      {frames.map((f) => (
        <figure key={f.at} style={{ margin: 0 }}>
          <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border)' }}>
            <ReplayPreview
              events={replayDemoEvents}
              chrome="none"
              controls={false}
              initialTime={f.at}
              title={`Frame at ${formatReplayTime(f.at)}`}
            />
          </div>
          <figcaption style={{ marginTop: 6, fontSize: 12.5, color: 'var(--muted-foreground)' }}>
            {formatReplayTime(f.at)} · {f.label}
          </figcaption>
        </figure>
      ))}
    </div>
  )
}
