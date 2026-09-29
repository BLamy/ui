import { useState } from 'react'
import {
  Avatar,
  Button,
  MarkdownEditor,
  MarkdownView,
  type MarkdownEditorAttachment,
} from '@brett_lamy/ui'

interface Comment {
  id: number
  author: { f: string; l: string }
  markdown: string
}

const maya = { f: 'Maya', l: 'Chen' }
const me = { f: 'Brett', l: 'Lamy' }

/* Chips serialize as ![name](attachment:id); swap in the stored image to render
   a posted comment. */
const withImages = (md: string, files: MarkdownEditorAttachment[]) =>
  md.replace(/\(attachment:([\w-]+)\)/g, (m, id) => {
    const src = files.find((f) => f.id === id)?.src
    return src ? `(${src})` : m
  })

export default function CommentBox() {
  const [markdown, setMarkdown] = useState('')
  const [attachments, setAttachments] = useState<MarkdownEditorAttachment[]>([])
  const [comments, setComments] = useState<Comment[]>([
    {
      id: 1,
      author: maya,
      markdown:
        'Can we tighten the empty state? The illustration feels **too big** ' +
        'on compact.',
    },
  ])

  const post = () => {
    if (!markdown.trim()) return
    setComments((all) => [
      ...all,
      {
        id: Date.now(),
        author: me,
        markdown: withImages(markdown, attachments),
      },
    ])
    setMarkdown('')
    setAttachments([])
  }

  return (
    <div style={{ display: 'grid', gap: 12, maxWidth: 560, margin: '0 auto' }}>
      {comments.map((c) => (
        <div key={c.id} style={{ display: 'flex', gap: 10 }}>
          <Avatar c={c.author} size={30} />
          <MarkdownView
            markdown={c.markdown}
            style={{ flex: 1, minWidth: 0, marginTop: -6 }}
          />
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
            onAttachmentAdd={({ file: _file, ...a }) =>
              setAttachments((all) => [...all, a])
            }
            onAttachmentRemove={(ids) =>
              setAttachments((all) => all.filter((a) => !ids.includes(a.id)))
            }
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ flex: 1, fontSize: 12, color: 'var(--bl-label3)' }}>
              ⌘↵ to post · {attachments.length} attachment
              {attachments.length === 1 ? '' : 's'}
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
