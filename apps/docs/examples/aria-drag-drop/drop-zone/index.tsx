import { useState } from 'react'
import { DropZone, FileTrigger, Text, isDirectoryDropItem, isFileDropItem, isTextDropItem, type DropItem } from 'react-aria-components'
import { Button } from '@/components/ui/button'

interface Dropped {
  label: string
  detail: string
}

async function read(items: DropItem[]): Promise<Dropped[]> {
  const out: Dropped[] = []
  for (const item of items) {
    if (isFileDropItem(item)) {
      const file = await item.getFile()
      out.push({ label: item.name, detail: `file · ${item.type} · ${file.size} bytes` })
    } else if (isTextDropItem(item)) {
      const type = item.types.has('text/plain') ? 'text/plain' : [...item.types][0]
      out.push({ label: (await item.getText(type)).slice(0, 80), detail: `text · ${[...item.types].join(', ')}` })
    } else if (isDirectoryDropItem(item)) {
      out.push({ label: item.name, detail: 'directory' })
    }
  }
  return out
}

// DropZone is useDrop with a visually hidden button, so it works with the
// keyboard and screen readers too. FileTrigger is the "or choose files" route.
export default function DropZoneDemo() {
  const [dropped, setDropped] = useState<Dropped[]>([])
  return (
    <div className="mx-auto grid w-full max-w-md gap-3">
      <DropZone
        onDrop={async (e) => setDropped(await read(e.items))}
        className="grid min-h-36 place-items-center rounded-panel border border-dashed border-border bg-card p-4 text-center outline-none data-drop-target:border-primary data-drop-target:bg-accent data-focus-visible:ring-[3px] data-focus-visible:ring-ring/45"
      >
        <div className="grid justify-items-center gap-2">
          <Text slot="label" className="text-footnote text-foreground">
            Drop files or text here
          </Text>
          <FileTrigger
            allowsMultiple
            onSelect={async (list) => {
              const files = [...(list ?? [])]
              setDropped(files.map((f) => ({ label: f.name, detail: `file · ${f.type || 'unknown'} · ${f.size} bytes` })))
            }}
          >
            <Button variant="secondary" size="sm">
              Choose files
            </Button>
          </FileTrigger>
        </div>
      </DropZone>
      <ul aria-label="Dropped items" className="m-0 grid list-none gap-2 p-0">
        {dropped.length ? (
          dropped.map((d, i) => (
            <li key={i} className="grid gap-0.5 rounded-ctl bg-card p-3 text-footnote shadow-hairline">
              <span className="text-foreground">{d.label}</span>
              <span className="text-foreground">{d.detail}</span>
            </li>
          ))
        ) : (
          <li className="text-footnote text-foreground">Nothing dropped yet.</li>
        )}
      </ul>
    </div>
  )
}
