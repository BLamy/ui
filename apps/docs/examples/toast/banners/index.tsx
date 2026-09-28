import { useState } from 'react'
import { Button, Toaster, createToastQueue, useToast } from '@brett_lamy/ui'

function Controls() {
  const toast = useToast()
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', maxWidth: 360 }}>
      <Button
        variant="secondary"
        onPress={() => toast('Message sent', { description: 'Delivered to Amelia.', icon: 'paperplane' })}
      >
        Banner
      </Button>
      <Button
        variant="secondary"
        onPress={() =>
          toast('Note moved to Trash', {
            action: { label: 'Undo', onAction: () => void toast.success('Note restored') },
          })
        }
      >
        With action
      </Button>
      <Button
        variant="secondary"
        onPress={() => {
          const id = toast.loading('Uploading 3 photos…')
          setTimeout(() => toast.update(id, { title: 'Uploaded', description: '3 photos · 12 MB', tone: 'success' }), 1600)
        }}
      >
        Loading → done
      </Button>
      <Button
        variant="secondary"
        onPress={() => toast.error('Couldn’t connect', { description: 'Check your connection and try again.' })}
      >
        Error
      </Button>
    </div>
  )
}

export default function Banners() {
  const [queue] = useState(() => createToastQueue())
  return (
    <div
      style={{
        position: 'relative',
        height: 380,
        display: 'grid',
        placeItems: 'end center',
        padding: 24,
        boxSizing: 'border-box',
        overflow: 'hidden',
        borderRadius: 14,
        background: 'var(--bl-bg)',
      }}
    >
      <Toaster queue={queue} placement="top" inline offset={16}>
        <Controls />
      </Toaster>
    </div>
  )
}
