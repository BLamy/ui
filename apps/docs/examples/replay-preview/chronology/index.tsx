import { useRef, useState } from 'react'
import {
  Button,
  Icon,
  ReplayPreview,
  formatReplayTime,
  getReplayMarkers,
  replayDemoEvents,
  type ReplayPreviewHandle,
} from '@brett_lamy/ui'

// The recording's own moments (minus clicks) as a chronology beside the player:
// `playerRef` seeks it, `onTimeUpdate` marks the steps already played.
const steps = getReplayMarkers(replayDemoEvents).filter(
  (m) => m.kind !== 'click',
)

export default function Chronology() {
  const player = useRef<ReplayPreviewHandle>(null)
  const [time, setTime] = useState(2300)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) 220px',
        gap: 16,
        width: '100%',
        maxWidth: 900,
        alignItems: 'start',
      }}
    >
      <ReplayPreview
        events={replayDemoEvents}
        initialTime={2300}
        chrome="minimal"
        playerRef={player}
        onTimeUpdate={setTime}
      />
      <ol style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 4 }}>
        {steps.map((m) => (
          <li key={m.id}>
            <Button
              variant="ghost"
              size="sm"
              onPress={() => player.current?.seek(m.time)}
              style={{
                width: '100%',
                justifyContent: 'flex-start',
                opacity: m.time <= time ? 1 : 0.5,
              }}
            >
              <Icon
                name={m.kind === 'error' ? 'exclamation-circle' : m.kind === 'network' ? 'globe' : 'flag'}
                size={15}
                style={{ color: m.kind === 'custom' ? 'var(--success)' : 'var(--destructive)' }}
              />
              <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--muted-foreground)' }}>
                {formatReplayTime(m.time)}
              </span>
              {m.label}
            </Button>
          </li>
        ))}
      </ol>
    </div>
  )
}
