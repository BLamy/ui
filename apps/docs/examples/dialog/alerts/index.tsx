import { useState } from 'react'
import { buttonVariants } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/dialog'
import { BLProvider } from '@/lib/theme'

const outcomes: Record<string, string> = {
  delete: 'Photo deleted',
  keep: 'Signed out, drafts kept',
  erase: 'Signed out, drafts deleted',
}

// Dialogs render into BLProvider's root, so the scrim covers the provider — a
// frame here — rather than the whole page. In an app, BLProvider is your root.
// AlertDialog is the centered iOS alert: role="alertdialog", focus starts on
// its first answer, and a press on the scrim does not dismiss it (Esc and the
// answers do). Each answer's `value` comes back as the close's `returnValue`.
export default function Alerts() {
  const [last, setLast] = useState('Nothing chosen yet')
  const report = (open: boolean, details: { returnValue?: unknown }) => {
    if (!open) setLast(outcomes[String(details.returnValue)] ?? 'Cancelled')
  }
  return (
    <div className="mx-auto h-80 max-w-md overflow-hidden rounded-card shadow-hairline">
      <BLProvider>
        <div className="grid h-full content-start gap-4 p-5">
          <div className="flex flex-wrap gap-3">
            <AlertDialog onOpenChange={report}>
              <AlertDialogTrigger className={buttonVariants({ variant: 'destructive' })}>Delete photo…</AlertDialogTrigger>
              <AlertDialogBackdrop />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this photo?</AlertDialogTitle>
                  <AlertDialogDescription>
                    It will be removed from all your devices. This can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
                  <AlertDialogClose tone="destructive" value="delete">Delete</AlertDialogClose>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <AlertDialog onOpenChange={report}>
              <AlertDialogTrigger className={buttonVariants({ variant: 'secondary' })}>Sign out…</AlertDialogTrigger>
              <AlertDialogBackdrop />
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Sign out of Northwind?</AlertDialogTitle>
                  <AlertDialogDescription>Keep a copy of your drafts on this device?</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter orientation="vertical">
                  <AlertDialogClose value="keep">Keep a copy</AlertDialogClose>
                  <AlertDialogClose tone="destructive" value="erase">Delete from this device</AlertDialogClose>
                  <AlertDialogClose variant="cancel">Cancel</AlertDialogClose>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
          <p className="m-0 text-footnote text-muted-foreground" aria-live="polite">{last}</p>
        </div>
      </BLProvider>
    </div>
  )
}
