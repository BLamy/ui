import { useRef, useState } from 'react'
import { ImageAnnotator } from '@/components/ui/pencilkit/image-annotator'

// A light screenshot to mark up. In an app: a pasted or uploaded image's URL.
const SHOT =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="560" height="340"><rect width="560" height="340" fill="#F2F2F7"/>' +
      '<rect x="20" y="20" width="520" height="52" rx="10" fill="#fff"/><rect x="20" y="92" width="520" height="228" rx="10" fill="#fff"/>' +
      '<rect x="40" y="160" width="300" height="12" rx="6" fill="#E5E5EA"/><rect x="460" y="152" width="52" height="30" rx="15" fill="#34C759"/>' +
      '<text x="40" y="52" fill="#3C3C43" font-family="system-ui,sans-serif" font-size="16">Settings</text></svg>',
  )

// Press the thumbnail: the image flies out of it into the lightbox, with
// PencilKit's tools under it. Save flattens the strokes into a PNG, which
// replaces the thumbnail.
export default function ImageAnnotatorDemo() {
  const [open, setOpen] = useState(false)
  const [src, setSrc] = useState(SHOT)
  const thumb = useRef<HTMLImageElement>(null)
  return (
    <div className="grid h-72 place-items-center">
      <button
        type="button"
        aria-label="Mark up settings.png"
        onClick={() => setOpen(true)}
        className="cursor-pointer overflow-hidden rounded-lg border border-border p-0"
      >
        <img ref={thumb} src={src} alt="" className="block w-48" />
      </button>
      <ImageAnnotator src={src} open={open} onOpenChange={setOpen} origin={() => thumb.current} onSave={setSrc} />
    </div>
  )
}
