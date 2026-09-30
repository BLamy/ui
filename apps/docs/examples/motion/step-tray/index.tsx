import { useState } from 'react'
import {
  AnimatedHeight,
  Button,
  ContentSwap,
  Icon,
  useDirection,
} from '@brett_lamy/ui'

const REVIEW = [
  ['To', 'Wei Chen'],
  ['Amount', '$120.00'],
  ['Network fee', '$0.12'],
  ['Arrives', 'About a minute'],
]

// Each step is a different height.
function Step({ step }: { step: number }) {
  if (step === 0)
    return (
      <div style={{ padding: '18px 18px 4px' }}>
        <div style={{ fontSize: 19, fontWeight: 750 }}>Send</div>
        <div style={{ fontSize: 14, color: 'var(--muted-foreground)', marginTop: 4 }}>
          To Wei Chen
        </div>
      </div>
    )
  if (step === 1)
    return (
      <div style={{ padding: '18px 18px 4px' }}>
        <div style={{ fontSize: 19, fontWeight: 750 }}>Amount</div>
        <div
          style={{
            fontSize: 40,
            fontWeight: 750,
            letterSpacing: -1,
            margin: '8px 0 2px',
          }}
        >
          $120.00
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
          Balance $2,480.00
        </div>
      </div>
    )
  return (
    <div style={{ padding: '18px 18px 4px' }}>
      <div style={{ fontSize: 19, fontWeight: 750 }}>Review</div>
      {REVIEW.map(([a, b], i) => (
        <div
          key={a}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '10px 0',
            fontSize: 15,
            boxShadow: i ? 'inset 0 1px 0 var(--border)' : undefined,
          }}
        >
          <span style={{ color: 'var(--muted-foreground)' }}>{a}</span>
          <span>{b}</span>
        </div>
      ))}
    </div>
  )
}

// AnimatedHeight springs the tray to fit each step; ContentSwap moves the step
// in the direction of travel; the button's label morphs (Continue → Confirm).
export default function SendTray() {
  const [step, setStep] = useState(0)
  const dir = useDirection(step)
  const last = step === 2
  return (
    <div
      style={{
        position: 'relative',
        height: 380,
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--muted)',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 12,
          maxWidth: 380,
          margin: '0 auto',
        }}
        className={
          'rounded-[28px] bg-card ' +
          'shadow-[0_24px_80px_rgba(0,0,0,.18),0_0_0_1px_var(--border)]'
        }
      >
        <AnimatedHeight>
          <ContentSwap id={step} direction={dir}>
            <Step step={step} />
          </ContentSwap>
        </AnimatedHeight>
        <div style={{ display: 'flex', gap: 8, padding: 16 }}>
          <Button
            variant="secondary"
            size="lg"
            aria-label="Back"
            isDisabled={step === 0}
            onPress={() => setStep(step - 1)}
          >
            <Icon name="chevL" size={18} sw={2.6} />
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onPress={() => setStep(last ? 0 : step + 1)}
          >
            {last ? 'Confirm' : 'Continue'}
          </Button>
        </div>
      </div>
    </div>
  )
}
