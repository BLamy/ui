import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { ToastProvider, ToastRegion, createToaster, useToast } from '@/components/ui/toast'
import { BLProvider } from '@/lib/theme'

// useToast() returns the queue of the nearest <ToastProvider> (the page's
// `toast` outside one). `loading` shows a spinner and stays until the toast is
// updated; `update` keeps its id, so the same card turns into the result.
function Actions() {
  const toast = useToast()
  const save = () => {
    const id = toast.loading('Saving draft…')
    setTimeout(() => toast.update(id, { title: 'Draft saved', type: 'success', duration: 2500 }), 1200)
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button variant="secondary" size="sm" onClick={save}>
        Save draft
      </Button>
      <Button
        variant="secondary"
        size="sm"
        onClick={() =>
          toast.error('Couldn’t connect', { description: 'Check your network.', action: { label: 'Retry', onAction: save } })
        }
      >
        Fail with a Retry
      </Button>
      <Button variant="secondary" size="sm" onClick={() => toast.dismiss()}>
        Dismiss all
      </Button>
    </div>
  )
}

export default function ToastQueue() {
  // A queue of its own. Its region renders into the BLProvider around it, so the
  // demo's toasts stay in the demo.
  const [queue] = useState(() => createToaster())
  return (
    <div className="h-72 overflow-hidden rounded-card">
      <BLProvider className="grid h-full place-items-center bg-background">
        <ToastProvider toaster={queue}>
          <Actions />
        </ToastProvider>
        <ToastRegion toaster={queue} offset={16} />
      </BLProvider>
    </div>
  )
}
