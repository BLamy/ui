import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError } from '@/components/ui/field'
import { FileUploadDropzone, FileUploadTrigger } from '@/components/ui/file-upload'
import { ReplayView, type ReplayFileData } from '@/components/ui/replay-debugger'
import { SHOP_RECORDING } from '@/components/blocks/replay-debugger/shop-recording'
import { SESSION_URLS } from '@/components/blocks/replay-debugger/sessions'
import { Icon } from '@/lib/icon'

// Drop a .replay file (or the same JSON gzipped) on the frame and it opens in the time travel debugger: one recording
// in the debugger, a session of several in the view that fits it. Drop another on the debugger to swap it. No file at
// hand? Download one of the demos below and drag it back in. The file is read in the browser and never uploaded.
const ACCEPT = ['.replay', '.json', '.gz']

async function readReplay(file: File): Promise<ReplayFileData> {
  const head = new Uint8Array(await file.slice(0, 2).arrayBuffer())
  const text =
    head[0] === 0x1f && head[1] === 0x8b
      ? await new Response(file.stream().pipeThrough(new DecompressionStream('gzip'))).text()
      : await file.text()
  const data = JSON.parse(text) as ReplayFileData
  if (typeof data?.format !== 'string' || !/^bl-replay-(cache|session)\//.test(data.format)) {
    throw new Error('not a .replay file (no bl-replay-cache or bl-replay-session format).')
  }
  return data
}

const DEMOS = [
  { name: 'shop.replay', label: 'One recording', load: async () => JSON.stringify(SHOP_RECORDING) },
  { name: 'checkout.replay', label: 'A page and four services', load: () => fetch(SESSION_URLS.checkout).then((r) => r.text()) },
  { name: 'tanstack.replay', label: 'A browser and its server', load: () => fetch(SESSION_URLS.tanstack).then((r) => r.text()) },
]

async function download(demo: (typeof DEMOS)[number]) {
  const url = URL.createObjectURL(new Blob([await demo.load()], { type: 'application/json' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: demo.name })
  a.click()
  URL.revokeObjectURL(url)
}

export default function DropAFile() {
  const [file, setFile] = useState<{ name: string; data: ReplayFileData; id: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = async ([dropped]: File[]) => {
    if (!dropped) return
    try {
      const data = await readReplay(dropped)
      setFile((f) => ({ name: dropped.name, data, id: (f?.id ?? 0) + 1 }))
      setError(null)
    } catch (e) {
      setError(`${dropped.name}: ${e instanceof SyntaxError ? 'not JSON.' : (e as Error).message}`)
    }
  }

  return (
    <div className="grid w-full gap-2">
      <Field invalid={!file && !!error}>
        <FileUploadDropzone
          aria-label="Drop a .replay file"
          onFiles={load}
          multiple={false}
          rules={{ accept: ACCEPT }}
          title="Drop a .replay file"
          description="One recording or a session, as JSON, gzipped or not"
          icon="play-rectangle"
          browseLabel="Choose a file"
          className={file ? 'block min-h-0 border-0 p-0' : 'min-h-72'}
        >
          {file
            ? ({ dragging }) => (
                <div className="relative h-[640px] overflow-hidden rounded-card ring-1 ring-border">
                  {/* A new key remounts the debugger, so every drop starts from its first step. */}
                  <ReplayView key={file.id} data={file.data} className="h-full" />
                  {dragging ? (
                    <div className="absolute inset-0 grid place-items-center rounded-card border-2 border-dashed border-primary bg-background/80 text-subhead font-semibold">
                      Drop to open this file instead
                    </div>
                  ) : null}
                </div>
              )
            : undefined}
        </FileUploadDropzone>
        <FieldError>{error}</FieldError>
      </Field>
      <div className="flex flex-wrap items-center gap-2 text-footnote text-foreground/70">
        {file ? (
          <>
            <Icon name="play-rectangle" size={14} />
            <span className="min-w-0 flex-1 truncate">{error ?? `${file.name} · ${file.data.format} · drop another on the debugger to swap it`}</span>
            <FileUploadTrigger variant="ghost" size="sm" accept={ACCEPT} multiple={false} onFiles={load}>
              Choose another
            </FileUploadTrigger>
            <Button variant="ghost" size="sm" onClick={() => { setFile(null); setError(null) }}>
              Clear
            </Button>
          </>
        ) : (
          <>
            <span className="flex-1">No file handy? Download a demo and drag it in.</span>
            {DEMOS.map((demo) => (
              <Button key={demo.name} variant="ghost" size="sm" title={demo.label} onClick={() => void download(demo)}>
                <Icon name="arrow-down" size={14} />
                {demo.name}
              </Button>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
