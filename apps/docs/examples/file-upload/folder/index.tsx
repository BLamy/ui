import { FileUpload } from '@/components/ui/file-upload'
import type { UploadContext } from '@/lib/file-upload-model'

// A stand-in for your server (see the basic example).
function mockUpload(_file: File, { signal, onProgress }: UploadContext) {
  return new Promise<void>((resolve, reject) => {
    let sent = 0
    const timer = setInterval(() => {
      sent += 0.5
      onProgress(Math.min(sent, 1))
      if (sent >= 1) {
        clearInterval(timer)
        resolve()
      }
    }, 200)
    signal.addEventListener('abort', () => {
      clearInterval(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

// `directory` makes the button choose a folder (drops take folders anyway).
// The folder is flattened into its files, each keeping its path inside it.
export default function Folder() {
  return (
    <div className="mx-auto w-full max-w-md">
      <FileUpload directory upload={mockUpload} />
    </div>
  )
}
