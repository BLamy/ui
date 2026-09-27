import { useEffect, useState, type ReactNode } from 'react'
import { Button, Haptics, HapticIndicator, type HapticEvent } from '@brett_lamy/ui'

// A rounded window, capped at `width` and centered.
function Window({ width, children }: { width: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--bl-bg)',
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function HapticLog() {
  const [events, setEvents] = useState<HapticEvent[]>([])
  // Haptics.on observes every call (from your code and from the components).
  useEffect(() => Haptics.on((e) => setEvents((list) => [e, ...list].slice(0, 5))), [])
  return (
    <Window width={520}>
      <div
        style={{ position: 'relative', height: 300, padding: 16, boxSizing: 'border-box' }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <Button size="sm" variant="secondary" onPress={() => Haptics.impact('light')}>
            Light
          </Button>
          <Button size="sm" variant="secondary" onPress={() => Haptics.impact('heavy')}>
            Heavy
          </Button>
          <Button size="sm" variant="secondary" onPress={() => Haptics.selection()}>
            Selection
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onPress={() => Haptics.notification('warning')}
          >
            Warning
          </Button>
        </div>
        <ol
          style={{
            margin: '14px 0 0',
            padding: 0,
            listStyle: 'none',
            fontFamily: 'ui-monospace, Menlo, monospace',
            fontSize: 12.5,
          }}
        >
          {events.length ? (
            events.map((e, i) => (
              <li
                key={i}
                style={{
                  padding: '6px 0',
                  borderBottom: '1px solid var(--bl-sep)',
                  opacity: 1 - i * 0.16,
                }}
              >
                {e.label} <span style={{ color: 'var(--bl-label3)' }}>· weight {e.w}</span>
              </li>
            ))
          ) : (
            <li style={{ color: 'var(--bl-label2)' }}>Press a button…</li>
          )}
        </ol>
        {/* The pill the Contacts demo shows: last event + active engine */}
        <HapticIndicator visible bottom={12} />
      </div>
    </Window>
  )
}
