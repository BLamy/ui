import { FileUpload } from '@/components/ui/file-upload'
import type { UploadContext } from '@/lib/file-upload'

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

// Every rule that fails leaves the file in the list as "Not added", with its
// reason, until it is dismissed. Try a .zip, a large file, a fourth file, the
// same file twice, or a name with a space in it. The server still has to check.
export default function Validation() {
  return (
    <div className="mx-auto w-full max-w-md">
      <FileUpload
        accept={['image/*', '.pdf']}
        maxSize={2 * 1024 * 1024}
        maxFiles={3}
        validate={(file) =>
          /\s/.test(file.name) ? 'Rename it without spaces first.' : undefined
        }
        messages={{ duplicate: 'You already added this file.' }}
        upload={mockUpload}
      />
    </div>
  )
}
