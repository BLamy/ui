import { useEffect, useId, useRef, useState, type ClipboardEvent } from 'react'
import { isFileDropItem, isTextDropItem, mergeProps, useClipboard, useFocusRing } from 'react-aria'
import type { DropItem } from 'react-aria'

type Entry =
  | { kind: 'text'; types: string[]; preview: string }
  | { kind: 'file'; name: string; type: string; size: number; url: string | null }
  | { kind: 'directory'; name: string }

const fileEntry = (file: File): Entry => ({
  kind: 'file',
  name: file.name,
  type: file.type,
  size: file.size,
  url: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
})

// onPaste hands over every item on the clipboard at once. Text arrives as ONE
// item that lists all its formats (text/plain, text/html, …) and reads each
// lazily with getText(type); files arrive as separate file items.
async function describe(items: DropItem[], nativeFiles: File[]): Promise<Entry[]> {
  const out: Entry[] = []
  for (const item of items) {
    if (isTextDropItem(item)) {
      const types = [...item.types]
      const type = types.includes('text/plain') ? 'text/plain' : types[0]
      out.push({ kind: 'text', types, preview: (await item.getText(type)).slice(0, 160) })
    } else if (isFileDropItem(item)) {
      out.push(fileEntry(await item.getFile()))
    } else {
      out.push({ kind: 'directory', name: item.name })
    }
  }
  // Chromium hands pasted files (a screenshot, a copied image) over without
  // a file-system entry, and react-aria drops items it cannot make an entry for.
  // The files are still on the native event, so the element's own onPaste
  // (which runs first) set them aside.
  if (!out.some((e) => e.kind === 'file')) out.push(...nativeFiles.map(fileEntry))
  return out
}

export default function PasteInspector() {
  const [entries, setEntries] = useState<Entry[] | null>(null)
  const [pastes, setPastes] = useState(0)
  const hint = useId()
  const nativeFiles = useRef<File[]>([])

  const { clipboardProps } = useClipboard({
    onPaste: async (items) => {
      const files = nativeFiles.current
      nativeFiles.current = []
      setPastes((n) => n + 1)
      setEntries(await describe(items, files))
    },
  })
  const { focusProps, isFocusVisible } = useFocusRing()

  // Object URLs for pasted images are released when the list is replaced.
  useEffect(() => () => entries?.forEach((e) => e.kind === 'file' && e.url && URL.revokeObjectURL(e.url)), [entries])

  return (
    <div className="mx-auto grid w-full max-w-md gap-3">
      <div
        tabIndex={0}
        role="group"
        aria-label="Paste target"
        aria-describedby={hint}
        {...mergeProps(clipboardProps, focusProps, {
          onPaste: (e: ClipboardEvent) => {
            nativeFiles.current = Array.from(e.clipboardData.files)
          },
        })}
        data-focus-visible={isFocusVisible || undefined}
        className="grid min-h-28 place-items-center rounded-panel border border-dashed border-border bg-card p-4 text-center text-footnote text-foreground outline-none data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
      >
        <span id={hint}>Click here (or Tab to it), then paste text, an image or files with Mod+V.</span>
      </div>

      <div role="status" aria-label="Pasted items" className="grid gap-2">
        {entries === null ? (
          <p className="m-0 text-footnote text-foreground">Nothing pasted yet.</p>
        ) : entries.length === 0 ? (
          <p className="m-0 text-footnote text-foreground">The clipboard was empty (paste {pastes}).</p>
        ) : (
          entries.map((e, i) => (
            <div key={i} className="grid gap-1 rounded-ctl bg-card p-3 text-footnote shadow-hairline">
              {e.kind === 'text' ? (
                <>
                  <div className="text-foreground">text · {e.types.join(', ')}</div>
                  <div className="text-foreground">{e.preview}</div>
                </>
              ) : e.kind === 'file' ? (
                <>
                  <div className="text-foreground">
                    file · {e.type} · {e.size} bytes
                  </div>
                  <div className="text-foreground">{e.name}</div>
                  {e.url ? <img src={e.url} alt={`Pasted ${e.name}`} className="max-h-32 w-fit rounded-ctl" /> : null}
                </>
              ) : (
                <div className="text-foreground">directory · {e.name}</div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
