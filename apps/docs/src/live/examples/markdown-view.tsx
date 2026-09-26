/* MarkdownView page examples. Each `// #region` is shown verbatim as the example's code. */
import { useState } from 'react'
import { Button } from '@brett_lamy/ui'
import { MarkdownView, type ReferenceNode } from '@brett_lamy/workbench'
import raw from './markdown-view.tsx?raw'
import { examples } from './chrome'

// #region md_chat
const turns = [
  { role: 'user', text: 'How do I keep a panel’s state while it is hidden?' },
  {
    role: 'assistant',
    text: [
      'Pass `shouldForceMount` to the panel. It stays mounted and is only **hidden**:',
      '',
      '```tsx',
      '<TabViewPanel id="settings" shouldForceMount>',
      '  <Settings />',
      '</TabViewPanel>',
      '```',
      '',
      '- Scroll position survives switching tabs',
      '- Effects keep running, so pause expensive work yourself',
    ].join('\n'),
  },
]

export function ChatTranscript() {
  return (
    <div style={{ display: 'grid', gap: 14, padding: 18, maxWidth: 620, margin: '0 auto' }}>
      {turns.map((t, i) =>
        t.role === 'user' ? (
          <div
            key={i}
            style={{
              justifySelf: 'end',
              maxWidth: '80%',
              padding: '8px 13px',
              borderRadius: '16px 16px 4px 16px',
              background: 'var(--wb-tint)',
              color: '#fff',
              fontSize: 14,
            }}
          >
            {t.text}
          </div>
        ) : (
          <MarkdownView key={i} markdown={t.text} />
        ),
      )}
    </div>
  )
}
// #endregion

// #region md_notes
const notes = `## Release 2.4

{% hint style="info" %}
**Heads up:** \`TabBar\` now hides with the scroll by default. Pass \`hideOnScroll={false}\` to pin it.
{% endhint %}

| Component | Change | Breaking |
| --- | --- | --- |
| TabView | New \`TabViewIndicator\` pill variant | No |
| List | \`header\` measures itself | No |
| Credenza | \`compact\` tray is draggable | Yes |

> Upgrade with \`pnpm up @brett_lamy/ui\`.`

export function ReleaseNotes() {
  return (
    <div
      style={{
        padding: '6px 22px',
        borderRadius: 14,
        background: 'var(--bl-card)',
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep)',
      }}
    >
      <MarkdownView markdown={notes} />
    </div>
  )
}
// #endregion

// #region md_references
const answer = `@maya shipped the tray drag in #credenza last week, and @jonas tuned the haptics in #feedback.

Ask either of them before changing the release threshold.`

export function AnswerWithReferences() {
  const [picked, setPicked] = useState<ReferenceNode | null>(null)
  return (
    <div
      style={{
        padding: '6px 22px 16px',
        borderRadius: 14,
        background: 'var(--bl-card)',
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep)',
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
          color: 'var(--bl-label2)',
        }}
      >
        {picked ? (
          <>
            Clicked <code>{picked.kind}</code>{' '}
            <strong style={{ color: 'var(--bl-label)' }}>
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
// #endregion

export const MARKDOWN_VIEW_LIVE = examples(raw, [
  {
    id: 'md_chat',
    title: 'Assistant replies in a chat transcript',
    theme: 'wb',
    h: 360,
    Render: () => <ChatTranscript />,
  },
  {
    id: 'md_notes',
    title: 'Release notes · hints, tables, quotes',
    h: 420,
    Render: () => <ReleaseNotes />,
  },
  {
    id: 'md_references',
    title: 'Mentions and tags · onReferenceClick',
    h: 240,
    Render: () => <AnswerWithReferences />,
  },
])
