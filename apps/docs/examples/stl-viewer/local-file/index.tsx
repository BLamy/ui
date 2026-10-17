import { useEffect, useState } from 'react'
import { DropZone, FileTrigger, Text } from 'react-aria-components'
import { Button } from '@/components/ui/button'
import { StlViewer } from '@/components/ui/stl-viewer'

// A model from your computer: choose or drop an .stl and it is shown from a blob: URL. Nothing is uploaded.
export default function LocalFile() {
  const [model, setModel] = useState<{ name: string; url: string } | null>(null)
  useEffect(() => () => { if (model) URL.revokeObjectURL(model.url) }, [model])
  const open = (file: File | undefined) => {
    if (file && /\.stl$/i.test(file.name)) setModel({ name: file.name, url: URL.createObjectURL(file) })
  }
  return (
    <div className="flex w-full max-w-[640px] flex-col gap-3">
      <DropZone
        aria-label="Drop an .stl file"
        onDrop={async (e) => {
          for (const item of e.items) if (item.kind === 'file') { open(await item.getFile()); break }
        }}
        className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-border px-4 py-3 data-[drop-target]:border-primary data-[drop-target]:bg-secondary"
      >
        <Text slot="label" className="text-detail">{model ? model.name : 'Drop an .stl file here, or'}</Text>
        <FileTrigger acceptedFileTypes={['.stl', 'model/stl']} onSelect={(files) => open(files?.[0])}>
          <Button variant="secondary" size="sm">Choose File…</Button>
        </FileTrigger>
      </DropZone>
      {model ? <StlViewer key={model.url} src={model.url} title={model.name} /> : null}
    </div>
  )
}
