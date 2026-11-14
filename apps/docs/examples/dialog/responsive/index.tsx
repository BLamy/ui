import { Button, buttonVariants } from '@/components/ui/button'
import {
  Dialog,
  DialogBackdrop,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { BLProvider } from '@/lib/theme'
import { cn } from '@/lib/utils'

// The same Dialog, with no `presentation`: "auto" is the default. In the wide
// frame (a medium size-class scope) it is a centered card; in the phone-sized
// frame (compact) it is a sheet you can drag down, its buttons sharing the row.
// The choice is made each time it opens. `variant="tray"` would float it inset
// from the edges instead.
export default function Responsive({ variant = 'regular' }: { variant?: string }) {
  const compact = variant === 'compact'
  return (
    <div
      className={cn(
        'relative mx-auto w-full overflow-hidden rounded-card shadow-hairline',
        compact ? 'h-[600px] max-w-[390px]' : 'h-[480px] max-w-[720px]',
      )}
    >
      <BLProvider>
        <div className="grid h-full place-items-center p-5">
          <Dialog>
            <DialogTrigger className={buttonVariants()}>New list…</DialogTrigger>
            <DialogBackdrop />
            <DialogContent initialFocus="input">
              <DialogClose />
              <DialogHeader>
                <DialogTitle>New list</DialogTitle>
                <DialogDescription>Lists sync to every device signed in to your account.</DialogDescription>
              </DialogHeader>
              <DialogBody>
                <Field>
                  <FieldLabel>Name</FieldLabel>
                  <Input defaultValue="Groceries" />
                </Field>
              </DialogBody>
              <DialogFooter>
                <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
                <DialogClose render={<Button />} value="create">Create</DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </BLProvider>
    </div>
  )
}
