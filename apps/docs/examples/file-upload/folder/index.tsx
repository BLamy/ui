import { FileUpload } from '@/components/ui/file-upload'
import type { UploadContext } from '@/lib/file-upload'

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

// `acceptDirectory` lets people drop a folder or choose one with the button.
// The folder is flattened into its files, each keeping its relative path.
export default function Folder() {
  return (
    <div className="mx-auto w-full max-w-md">
      <FileUpload acceptDirectory upload={mockUpload} />
    </div>
  )
}
