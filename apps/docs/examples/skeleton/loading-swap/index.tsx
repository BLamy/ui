import { useEffect, useState } from 'react'
import {
  AnimatedHeight,
  Button,
  ContentSwap,
  Skeleton,
  SkeletonText,
} from '@brett_lamy/ui'

const order = {
  title: 'Order #4821',
  status: 'Out for delivery',
  lines: [
    ['Oat flat white', '$5.20'],
    ['Almond croissant', '$4.80'],
    ['Delivery', '$2.99'],
  ],
  total: '$12.99',
}

function Loading() {
  return (
    <div style={{ display: 'grid', gap: 12, padding: 18 }}>
      <Skeleton shape="text" height={20} width={140} />
      <Skeleton shape="text" height={12} width={100} />
      <SkeletonText lines={3} lastLineWidth="100%" gap={14} />
    </div>
  )
}

function Loaded() {
  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 19, fontWeight: 750 }}>{order.title}</div>
      <div style={{ fontSize: 13, color: 'var(--bl-green)', marginTop: 3 }}>
        {order.status}
      </div>
      {order.lines.map(([name, price]) => (
        <div
          key={name}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            padding: '9px 0',
            fontSize: 15,
            boxShadow: 'inset 0 -1px 0 var(--bl-sep)',
          }}
        >
          <span>{name}</span>
          <span style={{ color: 'var(--bl-label2)' }}>{price}</span>
        </div>
      ))}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: 10,
          fontWeight: 700,
        }}
      >
        <span>Total</span>
        <span>{order.total}</span>
      </div>
    </div>
  )
}

// The placeholder and the content share one card: ContentSwap cross-fades
// between them by key and AnimatedHeight springs the card to the new height,
// so the page below never jumps. "Reload" fetches again (a 1.2s fake delay).
export default function LoadingSwap() {
  const [loading, setLoading] = useState(true)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    setLoading(true)
    const t = setTimeout(() => setLoading(false), 1200)
    return () => clearTimeout(t)
  }, [attempt])
  return (
    <div style={{ display: 'grid', gap: 14, maxWidth: 380, margin: '0 auto' }}>
      <AnimatedHeight
        style={{
          borderRadius: 16,
          background: 'var(--bl-card)',
          boxShadow: '0 0 0 1px var(--bl-sep)',
        }}
      >
        <div aria-busy={loading} aria-live="polite">
          <ContentSwap id={loading ? 'loading' : 'loaded'}>
            {loading ? <Loading /> : <Loaded />}
          </ContentSwap>
        </div>
      </AnimatedHeight>
      <Button
        variant="secondary"
        isDisabled={loading}
        onPress={() => setAttempt((a) => a + 1)}
        style={{ justifySelf: 'center' }}
      >
        Reload
      </Button>
    </div>
  )
}
