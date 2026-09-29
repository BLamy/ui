import { MarkdownView, WorkbenchTheme } from '@brett_lamy/ui'

const turns = [
  { role: 'user', text: 'How do I keep a panel’s state while it is hidden?' },
  {
    role: 'assistant',
    text: [
      'Pass `shouldForceMount` to the panel. It stays mounted and is only ' +
        '**hidden**:',
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

function ChatTranscript() {
  return (
    <div
      style={{
        display: 'grid',
        gap: 14,
        padding: 18,
        maxWidth: 620,
        margin: '0 auto',
      }}
    >
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

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the
// app's light / dark appearance.
export default function ChatTranscriptExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <ChatTranscript />
    </WorkbenchTheme>
  )
}
