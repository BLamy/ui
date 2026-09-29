import { useState } from 'react'
import { Button, Icon, ProgressRing } from '@brett_lamy/ui'

// The arc springs to each new value and the percentage rolls its digits.
export default function Rings() {
  const [value, setValue] = useState(35)
  const step = (d: number) => setValue((v) => Math.min(100, Math.max(0, v + d)))
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <ProgressRing aria-label="Small" size="sm" value={value} />
        <ProgressRing aria-label="Medium" size="md" value={value} showValue />
        <ProgressRing aria-label="Large" size="lg" value={value} showValue />
        <ProgressRing
          aria-label="Upload"
          size="xl"
          value={value}
          showValue
          tone={value === 100 ? 'success' : 'default'}
        />
        <ProgressRing aria-label="Downloading" size="lg" value={value}>
          {value === 100 ? (
            <Icon
              name="check"
              size={18}
              sw={2.6}
              style={{ color: 'var(--success)' }}
            />
          ) : (
            <span
              style={{
                width: 11,
                height: 11,
                borderRadius: 2,
                background: 'var(--primary)',
              }}
            />
          )}
        </ProgressRing>
        <ProgressRing aria-label="Loading" size="lg" isIndeterminate />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" onPress={() => step(-20)}>
          −20
        </Button>
        <Button variant="secondary" onPress={() => step(20)}>
          +20
        </Button>
      </div>
    </div>
  )
}
