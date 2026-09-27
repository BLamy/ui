import { useState } from 'react'
import { MarkdownEditor, MarkdownView } from '@brett_lamy/ui'

const draft = `# Standup notes

Shipped the **tray drag** — the release threshold stays at \`0.4\`.

- [x] Haptics on detents
- [ ] Reduced-motion pass

> Next: the docs page.

Type \`/\` for blocks, or paste Markdown.`

export default function NotesWithPreview() {
  const [markdown, setMarkdown] = useState(draft)
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14,
      }}
    >
      <MarkdownEditor
        aria-label="Notes"
        variant="card"
        value={markdown}
        onValueChange={setMarkdown}
        minHeight={300}
        maxHeight={300}
      />
      <div
        style={{
          height: 300,
          overflow: 'auto',
          padding: '12px 16px',
          boxSizing: 'border-box',
          borderRadius: 14,
          background: 'var(--bl-bg)',
          color: 'var(--bl-label)',
          boxShadow: '0 0 0 1px var(--bl-sep)',
        }}
      >
        <MarkdownView markdown={markdown} />
      </div>
    </div>
  )
}
