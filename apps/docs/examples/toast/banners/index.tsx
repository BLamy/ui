import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { ToastRegion, createToaster, type Toaster } from '@/components/ui/toast'
import { BLProvider } from '@/lib/theme'

type Queue = Toaster<ReactNode>

const upload = () =>
  new Promise<string>((resolve) => {
    setTimeout(() => resolve('3 photos · 12 MB'), 1600)
  })

function Controls({ toast }: { toast: Queue }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
        maxWidth: 360,
      }}
    >
      <Button
        variant="secondary"
        onClick={() =>
          toast('Message sent', {
            description: 'Delivered to Amelia.',
            data: { icon: 'paperplane' },
          })
        }
      >
        Banner
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast('Note moved to Trash', {
            action: {
              label: 'Undo',
              onAction: () => void toast.success('Note restored'),
            },
          })
        }
      >
        With action
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          // One toast: a spinner while the promise runs, then its result.
          toast.promise(upload, {
            loading: 'Uploading 3 photos…',
            success: (summary: string) => ({
              title: 'Uploaded',
              description: summary,
            }),
            error: 'Couldn’t upload',
          })
        }
      >
        Loading → done
      </Button>
      <Button
        variant="secondary"
        onClick={() =>
          toast.error('Couldn’t connect', {
            description: 'Check your connection and try again.',
          })
        }
      >
        Error
      </Button>
    </div>
  )
}

export default function Banners() {
  // A queue of its own. Its region renders into the BLProvider around it, so
  // the demo's banners stay in the demo.
  const [toaster] = useState(() => createToaster())
  return (
    <div style={{ height: 380, overflow: 'hidden', borderRadius: 14 }}>
      <BLProvider className="bg-background">
        <div
          style={{
            height: '100%',
            display: 'grid',
            placeItems: 'end center',
            padding: 24,
            boxSizing: 'border-box',
          }}
        >
          <Controls toast={toaster} />
        </div>
        <ToastRegion toaster={toaster} side="top" offset={16} />
      </BLProvider>
    </div>
  )
}
