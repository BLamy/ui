import { useState } from 'react'
import {
  Composer,
  ComposerAdd,
  ComposerAttachments,
  ComposerCard,
  ComposerFooter,
  ComposerInput,
  ComposerSend,
  ComposerSpacer,
  Toaster,
  createToastQueue,
  type ComposerAttachment,
  WorkbenchTheme,
} from '@brett_lamy/ui'

// Stand-ins so the example opens with one of each kind of tile.
const svg = (body: string, w: number, h: number) =>
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">${body}</svg>`)

const screenshot = svg(
  '<rect width="560" height="340" fill="#1C1C23"/><rect x="24" y="24" width="512" height="60" rx="10" fill="#26262E"/>' +
    '<rect x="24" y="104" width="330" height="212" rx="10" fill="#101015"/><rect x="374" y="104" width="162" height="212" rx="10" fill="#0A84FF"/>',
  560,
  340,
)
const firstFrame = svg(
  '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2B2F77"/><stop offset="1" stop-color="#C2410C"/></linearGradient></defs>' +
    '<rect width="240" height="135" fill="url(#g)"/><circle cx="178" cy="44" r="18" fill="#FDE68A"/><path d="M0 135 L70 70 L120 110 L165 80 L240 135 Z" fill="#111827" opacity=".85"/>',
  240,
  135,
)

const seed: ComposerAttachment[] = [
  { id: 'f-shot', name: 'header.png', src: screenshot, size: 84 * 1024, type: 'image/svg+xml' },
  {
    id: 'f-code',
    name: 'chat.tsx',
    kind: 'text',
    size: 2300,
    excerpt: "import { Composer } from '@brett_lamy/ui'\n\nexport function Chat() {\n  const [busy, setBusy] = useState(false)\n  return (",
  },
  { id: 'f-video', name: 'repro.mov', kind: 'video', type: 'video/quicktime', size: 14.2 * 1024 * 1024, preview: firstFrame },
  { id: 'f-pdf', name: 'Design review.pdf', kind: 'pdf', type: 'application/pdf', size: 1.3 * 1024 * 1024 },
  { id: 'f-zip', name: 'logs.zip', kind: 'archive', type: 'application/zip', size: 3.4 * 1024 * 1024 },
]

// The rejection toasts land in this demo's own corner.
const queue = createToastQueue()

// Press + to pick files, drag files from your desktop onto the card, or paste them into the text.
// Images chip into the draft (click to annotate); other files become tiles — a video's first frame,
// code's first lines, a glyph for the rest. Files over 10 MB, or past 8, are turned away with a toast.
function FilesAndDrop() {
  const [sent, setSent] = useState('')
  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '20px 0' }}>
      <Composer
        defaultAttachments={seed}
        defaultValue="Here's the repro and the logs ![header.png](attachment:f-shot) — what's going on?"
        maxFileSize={10 * 1024 * 1024}
        maxFiles={8}
        onSubmit={(markdown, attachments) =>
          setSent(`${attachments.length} file${attachments.length === 1 ? '' : 's'}: ${attachments.map((a) => a.name).join(', ')}`)
        }
      >
        <ComposerCard>
          <ComposerAttachments />
          <ComposerInput placeholder="Ask anything — drop files here, or press +" />
          <ComposerFooter>
            <ComposerAdd />
            <ComposerSpacer />
            <ComposerSend />
          </ComposerFooter>
        </ComposerCard>
      </Composer>
      <p style={{ fontSize: 12, color: 'var(--muted-foreground)', textAlign: 'center', margin: '12px 0 0' }}>
        {sent || 'Drop files on the card, paste them, or press +. Backspace on a focused tile removes it.'}
      </p>
    </div>
  )
}

export default function FilesAndDropExample() {
  return (
    <WorkbenchTheme style={{ padding: 18, position: 'relative' }}>
      <Toaster queue={queue} inline placement="top" offset={12}>
        <FilesAndDrop />
      </Toaster>
    </WorkbenchTheme>
  )
}
