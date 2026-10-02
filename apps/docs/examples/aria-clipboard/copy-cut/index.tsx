import { useState } from 'react'
import { mergeProps, useClipboard, useFocusRing } from 'react-aria'
import { Button } from '@/components/ui/button'
import { Toaster, createToastQueue, useToast } from '@/components/ui/toast'

interface Snippet {
  id: string
  title: string
  code: string
}

const SNIPPETS: Snippet[] = [
  { id: 'a', title: 'Install', code: 'pnpm add @brett_lamy/ui' },
  { id: 'b', title: 'Import', code: "import { Button } from '@/components/ui/button'" },
  { id: 'c', title: 'Theme', code: '<ThemeScope appearance="dark">…</ThemeScope>' },
]

const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] ?? c)

function Row({ snippet, onCut }: { snippet: Snippet; onCut: () => void }) {
  const toast = useToast()
  const { clipboardProps } = useClipboard({
    // One item, three representations: pasting into a plain field gets the
    // text, a rich editor gets the <pre>, and our own paste target can read
    // the custom type back.
    getItems: ({ action }) => [
      {
        'text/plain': snippet.code,
        'text/html': `<pre><code>${escapeHtml(snippet.code)}</code></pre>`,
        'application/x-bl-snippet': JSON.stringify({ ...snippet, action }),
      },
    ],
    onCopy: () => toast.hud(`Copied “${snippet.title}”`, { tone: 'success' }),
    onCut: () => {
      onCut()
      toast.hud(`Cut “${snippet.title}”`)
    },
  })
  const { focusProps, isFocusVisible } = useFocusRing()

  return (
    <li className="flex items-center gap-3 rounded-ctl bg-card p-3 shadow-hairline">
      <div
        tabIndex={0}
        role="group"
        aria-label={`${snippet.title} snippet`}
        {...mergeProps(clipboardProps, focusProps)}
        data-focus-visible={isFocusVisible || undefined}
        className="min-w-0 flex-1 rounded-ctl outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
      >
        <div className="text-footnote text-foreground">{snippet.title}</div>
        <code className="block truncate font-mono text-footnote text-foreground">{snippet.code}</code>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onPress={async () => {
          // A button has no clipboard event to answer, so it uses the async
          // Clipboard API. It needs a secure context and a user gesture.
          try {
            await navigator.clipboard.write([
              new ClipboardItem({
                'text/plain': new Blob([snippet.code], { type: 'text/plain' }),
                'text/html': new Blob([`<pre><code>${escapeHtml(snippet.code)}</code></pre>`], { type: 'text/html' }),
              }),
            ])
            toast.hud(`Copied “${snippet.title}”`, { tone: 'success' })
          } catch {
            toast.hud('Clipboard not available', { tone: 'warning' })
          }
        }}
      >
        Copy
      </Button>
    </li>
  )
}

function Rows() {
  const [rows, setRows] = useState(SNIPPETS)
  return (
    <div className="grid w-[min(440px,100%)] gap-3">
      <ul aria-label="Snippets" className="m-0 grid list-none gap-2 p-0">
        {rows.map((s) => (
          <Row key={s.id} snippet={s} onCut={() => setRows((r) => r.filter((x) => x.id !== s.id))} />
        ))}
      </ul>
      {rows.length < SNIPPETS.length ? (
        <Button variant="secondary" size="sm" onPress={() => setRows(SNIPPETS)}>
          Restore snippets
        </Button>
      ) : (
        <p className="m-0 text-footnote text-foreground">Focus a snippet and press Mod+C to copy it or Mod+X to cut it.</p>
      )}
    </div>
  )
}

export default function CopyCut() {
  // A queue of its own, shown inside this box, like the Toast page's HUD demo.
  const [queue] = useState(() => createToastQueue())
  return (
    <div className="relative grid h-[340px] place-items-center overflow-hidden rounded-card bg-background">
      <Toaster queue={queue} placement="bottom" inline offset={18}>
        <Rows />
      </Toaster>
    </div>
  )
}
