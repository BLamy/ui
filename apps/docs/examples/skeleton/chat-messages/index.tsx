import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

// A thread loading: bubble-shaped placeholders on both sides, with varied
// widths so it reads as a conversation rather than a grid.
const thread: { mine: boolean; lines: number[] }[] = [
  { mine: false, lines: [220, 160] },
  { mine: true, lines: [180] },
  { mine: false, lines: [250, 230, 120] },
  { mine: true, lines: [140, 90] },
]

function Bubble({ mine, children }: { mine: boolean; children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 8,
        flexDirection: mine ? 'row-reverse' : 'row',
      }}
    >
      {mine ? null : <Skeleton shape="circle" width={28} height={28} />}
      <div
        style={{
          display: 'grid',
          gap: 7,
          padding: '11px 14px',
          borderRadius: 18,
          background: mine
            ? 'color-mix(in oklab, var(--primary) 16%, transparent)'
            : 'var(--card)',
          boxShadow: mine ? undefined : '0 0 0 1px var(--border)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default function ChatMessages() {
  return (
    <div
      role="group"
      aria-busy="true"
      aria-label="Loading messages"
      style={{
        display: 'grid',
        gap: 12,
        maxWidth: 440,
        margin: '0 auto',
        padding: 16,
        borderRadius: 16,
        background: 'var(--muted)',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      {thread.map((m, i) => (
        <Bubble key={i} mine={m.mine}>
          {m.lines.map((w, j) => (
            <Skeleton key={j} shape="text" width={w} height={12} />
          ))}
        </Bubble>
      ))}
    </div>
  )
}
