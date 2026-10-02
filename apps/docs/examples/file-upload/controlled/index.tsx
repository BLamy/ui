import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FileUpload } from '@/components/ui/file-upload'
import { useFileUpload, type UploadContext, type UploadFile } from '@/lib/file-upload'

// A stand-in for your server (see the basic example).
function mockUpload(_file: File, { signal, onProgress }: UploadContext) {
  return new Promise<void>((resolve, reject) => {
    let sent = 0
    const timer = setInterval(() => {
      sent += 0.25
      onProgress(Math.min(sent, 1))
      if (sent >= 1) {
        clearInterval(timer)
        resolve()
      }
    }, 300)
    signal.addEventListener('abort', () => {
      clearInterval(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

// The list lives in your state and nothing is sent until you submit: your own
// `useFileUpload` goes to <FileUpload state>, and the Submit button calls
// `uploadAll()` from outside it.
export default function Controlled() {
  const [files, setFiles] = useState<UploadFile[]>([])
  const up = useFileUpload({
    files,
    onFilesChange: setFiles,
    upload: mockUpload,
    autoUpload: false,
    maxFiles: 5,
  })
  const waiting = up.counts.queued
  return (
    <div className="mx-auto grid w-full max-w-md gap-3">
      <FileUpload state={up} />
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 text-footnote text-foreground/70" data-slot="summary">
          {files.length === 0
            ? 'No files yet.'
            : `${up.counts.done} of ${files.length - up.counts.rejected} sent`}
        </p>
        <Button isDisabled={waiting === 0 || up.counts.uploading > 0} onPress={up.uploadAll}>
          {waiting > 0 ? `Submit ${waiting} ${waiting === 1 ? 'file' : 'files'}` : 'Submit'}
        </Button>
      </div>
    </div>
  )
}
