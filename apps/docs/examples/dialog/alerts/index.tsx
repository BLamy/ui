import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DialogAction,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { BLProvider } from '@/lib/theme'

// Dialogs portal into BLProvider's root, so the scrim covers the provider — a
// frame here — rather than the whole page. In an app, BLProvider is your root.
// `size="alert"` is the centered iOS alert: role="alertdialog", and a press on
// the scrim does not dismiss it (Esc and the buttons do).
export default function Alerts() {
  const [last, setLast] = useState('Nothing chosen yet')
  return (
    <div className="mx-auto h-80 max-w-md overflow-hidden rounded-card shadow-hairline">
      <BLProvider>
        <div className="grid h-full content-start gap-4 p-5">
          <div className="flex flex-wrap gap-3">
            <DialogTrigger>
              <Button variant="destructive">Delete photo…</Button>
              <DialogContent size="alert">
                <DialogHeader>
                  <DialogTitle>Delete this photo?</DialogTitle>
                  <DialogDescription>
                    It will be removed from all your devices. This can&apos;t be undone.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogAction variant="cancel" onPress={() => setLast('Cancelled')}>Cancel</DialogAction>
                  <DialogAction variant="destructive" onPress={() => setLast('Photo deleted')}>Delete</DialogAction>
                </DialogFooter>
              </DialogContent>
            </DialogTrigger>

            <DialogTrigger>
              <Button variant="secondary">Sign out…</Button>
              <DialogContent size="alert">
                <DialogHeader>
                  <DialogTitle>Sign out of Northwind?</DialogTitle>
                  <DialogDescription>Keep a copy of your drafts on this device?</DialogDescription>
                </DialogHeader>
                <DialogFooter orientation="vertical">
                  <DialogAction onPress={() => setLast('Signed out, drafts kept')}>Keep a copy</DialogAction>
                  <DialogAction variant="destructive" onPress={() => setLast('Signed out, drafts deleted')}>
                    Delete from this device
                  </DialogAction>
                  <DialogAction variant="cancel">Cancel</DialogAction>
                </DialogFooter>
              </DialogContent>
            </DialogTrigger>
          </div>
          <p className="m-0 text-footnote text-muted-foreground" aria-live="polite">{last}</p>
        </div>
      </BLProvider>
    </div>
  )
}
