import { useState } from 'react'
import { Button, MarkdownView, type ReferenceNode } from '@brett_lamy/ui'

const answer = `@maya shipped the tray drag in #credenza last week, and @jonas
tuned the haptics in #feedback.

Ask either of them before changing the release threshold.`

export default function MentionsAndTags() {
  const [picked, setPicked] = useState<ReferenceNode | null>(null)
  return (
    <div
      style={{
        padding: '6px 22px 16px',
        borderRadius: 14,
        background: 'var(--card)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      {/* @mentions and #tags render as chips; clicks come back to you */}
      <MarkdownView markdown={answer} onReferenceClick={setPicked} />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          fontSize: 13,
          color: 'var(--muted-foreground)',
        }}
      >
        {picked ? (
          <>
            Clicked <code>{picked.kind}</code>{' '}
            <strong style={{ color: 'var(--foreground)' }}>
              {picked.label ?? picked.id}
            </strong>
          </>
        ) : (
          'Click a chip.'
        )}
        {picked && (
          <Button size="sm" variant="ghost" onPress={() => setPicked(null)}>
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
