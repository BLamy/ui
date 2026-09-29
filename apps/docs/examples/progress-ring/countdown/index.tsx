import { useState } from 'react'
import {
  Button,
  CountdownRing,
  NumberMorph,
  useCountdown,
} from '@brett_lamy/ui'

// A verification code that rotates every 30 seconds. The ring drains once a
// second and turns red for the last five; when the period restarts it jumps
// back to full (and the code changes).
const codeFor = (n: number) => (482913 + n * 271829) % 1000000

export default function Countdown() {
  const [running, setRunning] = useState(false)
  const [period, setPeriod] = useState(0)
  const { remaining } = useCountdown(30, {
    running,
    onEnd: () => setPeriod((p) => p + 1),
  })
  const code = codeFor(period)
  const fmt = { minimumIntegerDigits: 3, useGrouping: false }
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 18 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '12px 16px',
          borderRadius: 14,
          background: 'var(--bl-card)',
          boxShadow: '0 0 0 1px var(--bl-sep)',
        }}
      >
        <div>
          <div style={{ fontSize: 12.5, color: 'var(--bl-label2)' }}>
            Verification Code
          </div>
          <div
            style={{
              display: 'flex',
              gap: '.3em',
              fontSize: 24,
              fontWeight: 500,
              color: 'var(--bl-label)',
            }}
          >
            <NumberMorph value={Math.floor(code / 1000)} format={fmt} />
            <NumberMorph value={code % 1000} format={fmt} />
          </div>
        </div>
        <CountdownRing remaining={remaining} size="md" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <CountdownRing remaining={8} size="sm" />
        <CountdownRing remaining={18} size="lg" />
        <CountdownRing remaining={4} size="lg" />
        <CountdownRing remaining={42} duration={60} size="xl" warnAt={10} />
      </div>
      <Button
        variant="secondary"
        size="sm"
        onPress={() => setRunning((r) => !r)}
      >
        {running ? 'Pause' : 'Start the clock'}
      </Button>
    </div>
  )
}
