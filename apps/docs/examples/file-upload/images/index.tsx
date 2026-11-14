import { FileUploadDropzone, FileUploadList, FileUpload, FileUploadTrigger } from '@/components/ui/file-upload'
import type { UploadContext } from '@/lib/file-upload-model'

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
// goes away. The camera button has a FileInput of its own (`capture` opens the
// camera straight from a phone) and hands what it takes to the upload's `add`,
// so the photos are checked and listed like the rest.
export default function Images() {
  return (
    <div className="mx-auto w-full max-w-md">
      <FileUpload
        accept={['image/*']}
        maxSize={8_000_000}
        maxFiles={6}
        upload={mockUpload}
      >
        {(up) => (
          <>
            <FileUploadDropzone title="Drop photos here" icon="photo" />
            <FileUploadTrigger
              variant="ghost"
              size="sm"
              accept={['image/*']}
              capture="environment"
              onFiles={(files) => up.add(files)}
              className="self-start"
            >
              Take a photo
            </FileUploadTrigger>
            <FileUploadList aria-label="Photos" />
          </>
        )}
      </FileUpload>
    </div>
  )
}
