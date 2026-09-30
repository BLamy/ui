import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { MarkdownEditor, type MarkdownEditorHandle } from '@/components/ui/markdown-editor'

const blocks: { label: string; markdown: string }[] = [
  {
    label: 'Hint',
    markdown:
      '{% hint style="warning" %}\nMind the release threshold.\n{% endhint %}',
  },
  {
    label: 'Table',
    markdown:
      '| Step | Owner |\n| --- | --- |\n| Design | Maya |\n| Build | Jonas |',
  },
  { label: 'Code', markdown: '```tsx\n<Credenza compact open={open} />\n```' },
  { label: 'Tasks', markdown: '- [ ] Write the docs\n- [ ] Record the demo' },
]

export default function SlashBlocks() {
  const editor = useRef<MarkdownEditorHandle>(null)
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {blocks.map((b) => (
          <Button
            key={b.label}
            size="sm"
            variant="secondary"
            onPress={() => editor.current?.insertMarkdown(b.markdown)}
          >
            + {b.label}
          </Button>
        ))}
        <Button
          size="sm"
          variant="ghost"
          onPress={() => editor.current?.clear()}
        >
          Clear
        </Button>
      </div>
      <MarkdownEditor
        ref={editor}
        aria-label="Document"
        variant="card"
        minHeight={220}
        placeholder="Type / for headings, lists, hints, tabs, tables, code…"
      />
    </div>
  )
}
