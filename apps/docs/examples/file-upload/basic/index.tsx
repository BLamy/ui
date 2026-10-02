import { FileUpload } from '@/components/ui/file-upload'
import type { UploadContext } from '@/lib/file-upload'

// A stand-in for your server: steady progress, and a file with "fail" in its
// name loses the connection once (so Retry has something to do).
const failedOnce = new Set<string>()
function mockUpload(file: File, { signal, onProgress }: UploadContext) {
  return new Promise<{ url: string }>((resolve, reject) => {
    const willFail = file.name.includes('fail') && !failedOnce.has(file.name)
    let sent = 0
    const timer = setInterval(() => {
      sent += 0.2
      onProgress(Math.min(sent, 1))
      if (willFail && sent >= 0.6) {
        clearInterval(timer)
        failedOnce.add(file.name)
        reject(new Error('Connection lost'))
      } else if (sent >= 1) {
        clearInterval(timer)
        resolve({ url: `https://example.com/uploads/${file.name}` })
      }
    }, 250)
    signal.addEventListener('abort', () => {
      clearInterval(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

export default function Basic() {
  return (
    <div className="mx-auto w-full max-w-md">
      <FileUpload upload={mockUpload} maxSize={10 * 1024 * 1024} />
    </div>
  )
}
