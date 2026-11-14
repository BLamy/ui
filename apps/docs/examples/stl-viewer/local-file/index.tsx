import { useEffect, useState } from 'react'
import { FileDropZone } from '@/components/ui/file-upload'
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
      <FileDropZone
        size="compact"
        multiple={false}
        rules={{ accept: ['.stl', 'model/stl'] }}
        title={model ? model.name : 'Drop an .stl file here'}
        hint="Or choose one"
        browseLabel="Choose File…"
        onFiles={(files) => open(files[0])}
      />
      {model ? <StlViewer key={model.url} src={model.url} title={model.name} /> : null}
    </div>
  )
}
