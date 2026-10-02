import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Toaster, createToastQueue, useToast } from '@/components/ui/toast'

// useToast() returns the API of the nearest <Toaster>'s queue (the default
// queue outside one). The object is stable per queue, so it is safe in deps
// arrays. `loading` shows a spinner and no timeout until the toast is updated.
function Actions() {
  const toast = useToast()
  const save = () => {
    const id = toast.loading('Saving draft…')
    setTimeout(() => toast.update(id, { title: 'Draft saved', tone: 'success' }, { timeout: 2500 }), 1200)
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button variant="secondary" size="sm" onPress={save}>
        Save draft
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onPress={() =>
          toast.error('Couldn’t connect', { description: 'Check your network.', action: { label: 'Retry', onAction: save } })
        }
      >
        Fail with a Retry
      </Button>
      <Button variant="secondary" size="sm" onPress={() => toast.dismiss()}>
        Dismiss all
      </Button>
    </div>
  )
}

export default function ToastQueue() {
  // A queue of its own, drawn inside this box (`inline`) so the demo's toasts stay in the demo.
  const [queue] = useState(() => createToastQueue())
  return (
    <div className="relative grid h-72 place-items-center overflow-hidden rounded-card bg-background">
      <Toaster queue={queue} placement="bottom" inline offset={16}>
        <Actions />
      </Toaster>
    </div>
  )
}
