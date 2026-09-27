/* MarkdownEditor page examples. Each `// #region` is shown verbatim as the example's code. */
import { useRef, useState } from 'react'
import {
  Avatar,
  Button,
  Form,
  Input,
  Label,
  MarkdownEditor,
  MarkdownView,
  TextField,
  type MarkdownEditorAttachment,
  type MarkdownEditorHandle,
} from '@brett_lamy/ui'
import raw from './markdown-editor.tsx?raw'
import { examples } from './chrome'

// #region mde_notes
const draft = `# Standup notes

Shipped the **tray drag** — the release threshold stays at \`0.4\`.

- [x] Haptics on detents
- [ ] Reduced-motion pass

> Next: the docs page.

Type \`/\` for blocks, or paste Markdown.`

export function NotesWithPreview() {
  const [markdown, setMarkdown] = useState(draft)
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
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
// #endregion

// #region mde_comment
interface Comment {
  id: number
  author: { f: string; l: string }
  markdown: string
}

const maya = { f: 'Maya', l: 'Chen' }
const me = { f: 'Brett', l: 'Lamy' }

/* Chips serialize as ![name](attachment:id); swap in the stored image to render a posted comment. */
const withImages = (md: string, files: MarkdownEditorAttachment[]) =>
  md.replace(/\(attachment:([\w-]+)\)/g, (m, id) => {
    const src = files.find((f) => f.id === id)?.src
    return src ? `(${src})` : m
  })

export function CommentBox() {
  const [markdown, setMarkdown] = useState('')
  const [attachments, setAttachments] = useState<MarkdownEditorAttachment[]>([])
  const [comments, setComments] = useState<Comment[]>([
    { id: 1, author: maya, markdown: 'Can we tighten the empty state? The illustration feels **too big** on compact.' },
  ])

  const post = () => {
    if (!markdown.trim()) return
    setComments((all) => [...all, { id: Date.now(), author: me, markdown: withImages(markdown, attachments) }])
    setMarkdown('')
    setAttachments([])
  }

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 560, margin: '0 auto' }}>
      {comments.map((c) => (
        <div key={c.id} style={{ display: 'flex', gap: 10 }}>
          <Avatar c={c.author} size={30} />
          <MarkdownView markdown={c.markdown} style={{ flex: 1, minWidth: 0, marginTop: -6 }} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 10 }}>
        <Avatar c={me} size={30} />
        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 8 }}>
          <MarkdownEditor
            aria-label="Comment"
            placeholder="Leave a comment — paste a screenshot"
            variant="card"
            size="sm"
            minHeight={72}
            value={markdown}
            onValueChange={setMarkdown}
            onSubmit={post}
            imagePaste="chip"
            attachments={attachments}
            onAttachmentAdd={({ file: _file, ...a }) => setAttachments((all) => [...all, a])}
            onAttachmentRemove={(ids) => setAttachments((all) => all.filter((a) => !ids.includes(a.id)))}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--bl-label3)' }}>
              ⌘↵ to post · {attachments.length} attachment{attachments.length === 1 ? '' : 's'}
            </span>
            <Button size="sm" isDisabled={!markdown.trim()} onPress={post}>
              Comment
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
// #endregion

// #region mde_readonly
const spec = `## Release 2.4

{% hint style="info" %}
\`TabBar\` now hides with the scroll by default.
{% endhint %}

| Component | Change |
| --- | --- |
| TabView | New pill indicator |
| Credenza | \`compact\` tray is draggable |`

export function ReadOnlyToggle({ mode }: { mode: string }) {
  const [markdown, setMarkdown] = useState(spec)
  if (mode === 'rendered') return <MarkdownView markdown={markdown} />
  return (
    <MarkdownEditor
      aria-label="Release notes"
      variant="card"
      toolbar
      readOnly={mode === 'readonly'}
      value={markdown}
      onValueChange={setMarkdown}
    />
  )
}
// #endregion

// #region mde_form
export function IssueForm() {
  const [submitted, setSubmitted] = useState<Record<string, string> | null>(null)
  const [body, setBody] = useState('')
  const [tried, setTried] = useState(false)
  const invalid = tried && !body.trim()

  return (
    <Form
      style={{ maxWidth: 520, margin: '0 auto' }}
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (!body.trim()) return
        setSubmitted(Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>)
      }}
    >
      <TextField name="title" isRequired defaultValue="Tray snaps back on slow drags">
        <Label variant="field">Title</Label>
        <Input />
      </TextField>
      <div style={{ display: 'grid', gap: 6 }}>
        <Label variant="field" id="issue-body-label">
          Description
        </Label>
        {/* name= submits the Markdown with the form */}
        <MarkdownEditor
          name="body"
          aria-labelledby="issue-body-label"
          aria-describedby="issue-body-help"
          placeholder="Steps to reproduce, expected, actual…"
          size="sm"
          invalid={invalid}
          value={body}
          onValueChange={setBody}
        />
        <span
          id="issue-body-help"
          style={{ padding: '0 4px', fontSize: 13, color: invalid ? 'var(--bl-red)' : 'var(--bl-label2)' }}
        >
          {invalid ? 'Describe the issue.' : 'Markdown works — lists, links, code blocks.'}
        </span>
      </div>
      <Button type="submit" style={{ alignSelf: 'flex-start' }}>
        File issue
      </Button>
      {submitted && (
        <pre style={{ margin: 0, fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--bl-label2)' }}>
          {JSON.stringify(submitted, null, 2)}
        </pre>
      )}
    </Form>
  )
}
// #endregion

// #region mde_slash
const blocks: { label: string; markdown: string }[] = [
  { label: 'Hint', markdown: '{% hint style="warning" %}\nMind the release threshold.\n{% endhint %}' },
  { label: 'Table', markdown: '| Step | Owner |\n| --- | --- |\n| Design | Maya |\n| Build | Jonas |' },
  { label: 'Code', markdown: '```tsx\n<Credenza compact open={open} />\n```' },
  { label: 'Tasks', markdown: '- [ ] Write the docs\n- [ ] Record the demo' },
]

export function SlashBlocks() {
  const editor = useRef<MarkdownEditorHandle>(null)
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {blocks.map((b) => (
          <Button key={b.label} size="sm" variant="secondary" onPress={() => editor.current?.insertMarkdown(b.markdown)}>
            + {b.label}
          </Button>
        ))}
        <Button size="sm" variant="ghost" onPress={() => editor.current?.clear()}>
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
// #endregion

export const MARKDOWN_EDITOR_LIVE = examples(raw, [
  {
    id: 'mde_notes',
    title: 'Notes with a live MarkdownView preview',
    h: 340,
    Render: () => <NotesWithPreview />,
  },
  {
    id: 'mde_comment',
    title: 'Comment box · chip image paste',
    h: 280,
    Render: () => <CommentBox />,
  },
  {
    id: 'mde_readonly',
    title: 'Editable, read-only, rendered',
    h: 320,
    variants: [
      { id: 'edit', label: 'Edit' },
      { id: 'readonly', label: 'Read-only' },
      { id: 'rendered', label: 'Rendered' },
    ],
    variantsWidth: 270,
    Render: ({ variant }) => <ReadOnlyToggle mode={variant} />,
  },
  {
    id: 'mde_form',
    title: 'A form field · name, label, validation',
    h: 360,
    Render: () => <IssueForm />,
  },
  {
    id: 'mde_slash',
    title: 'Slash commands and blocks · ref.insertMarkdown',
    h: 320,
    Render: () => <SlashBlocks />,
  },
])
