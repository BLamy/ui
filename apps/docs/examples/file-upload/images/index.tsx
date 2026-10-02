import { FileDropZone, FileList, FileUpload, FileUploadButton } from '@/components/ui/file-upload'
import type { UploadContext } from '@/lib/file-upload'

// A stand-in for your server (see the basic example).
function mockUpload(_file: File, { signal, onProgress }: UploadContext) {
  return new Promise<{ url: string }>((resolve, reject) => {
    let sent = 0
    const timer = setInterval(() => {
      sent += 0.25
      onProgress(Math.min(sent, 1))
      if (sent >= 1) {
        clearInterval(timer)
        resolve({ url: 'https://example.com/uploads/photo' })
      }
    }, 300)
    signal.addEventListener('abort', () => {
      clearInterval(timer)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

// Image files get a thumbnail made from an object URL, revoked when the row
// goes away. `defaultCamera` opens the camera straight from a phone.
export default function Images() {
  return (
    <div className="mx-auto w-full max-w-md">
      <FileUpload
        accept={['image/*']}
        maxSize={8 * 1024 * 1024}
        maxFiles={6}
        upload={mockUpload}
      >
        <FileDropZone title="Drop photos here" icon="photo" />
        <FileUploadButton variant="ghost" size="sm" defaultCamera="environment" className="self-start">
          Take a photo
        </FileUploadButton>
        <FileList aria-label="Photos" />
      </FileUpload>
    </div>
  )
}
