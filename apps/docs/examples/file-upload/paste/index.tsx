import { FileDropZone, FileList, FileUpload } from '@/components/ui/file-upload'
import type { UploadContext } from '@/lib/file-upload-model'

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

// The zone takes images and files pasted from the clipboard (⌘V / Ctrl+V)
// while focus is inside it: copy a screenshot, focus "Browse files", paste.
// `pasteTarget="document"` would take pastes anywhere on the page.
export default function Paste() {
  return (
    <div className="mx-auto w-full max-w-md">
      <FileUpload accept={['image/*']} upload={mockUpload}>
        <FileDropZone
          size="compact"
          icon="photo"
          title="Paste a screenshot"
          hint="Focus the button, then press ⌘V or Ctrl+V."
        />
        <FileList />
      </FileUpload>
    </div>
  )
}
