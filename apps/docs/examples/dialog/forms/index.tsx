import { useState } from 'react'
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
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { BLProvider } from '@/lib/theme'

// `default` (400px) and `lg` (560px) are general dialogs: header, a scrolling
// body, a right-aligned footer, a round × in the corner. Save is a DialogClose
// rendered as a Button; its `action` runs before the dialog closes.
export default function Forms() {
  const [name, setName] = useState('Aurora redesign')
  const [draft, setDraft] = useState(name)
  const empty = draft.trim() === ''
  return (
    <div className="mx-auto h-96 max-w-2xl overflow-hidden rounded-card shadow-hairline">
      <BLProvider>
        <div className="grid h-full content-start gap-3 p-5">
          <div className="text-body">
            Project: <strong>{name}</strong>
          </div>
          <div>
            <Dialog onOpenChange={(open) => open && setDraft(name)}>
              <DialogTrigger className={buttonVariants({ variant: 'secondary' })}>Rename…</DialogTrigger>
              <DialogBackdrop />
              <DialogContent initialFocus="input">
                <DialogClose />
                <DialogHeader>
                  <DialogTitle>Rename project</DialogTitle>
                  <DialogDescription>
                    Names are visible to everyone in the workspace.
                  </DialogDescription>
                </DialogHeader>
                <DialogBody>
                  <Field invalid={empty ? true : undefined}>
                    <FieldLabel>Name</FieldLabel>
                    <Input value={draft} onValueChange={setDraft} />
                    <FieldError match>A project needs a name.</FieldError>
                  </Field>
                </DialogBody>
                <DialogFooter>
                  <DialogClose render={<Button variant="secondary" />}>Cancel</DialogClose>
                  <DialogClose
                    render={<Button />}
                    disabled={empty}
                    value="save"
                    action={() => setName(draft.trim())}
                  >
                    Save
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </BLProvider>
    </div>
  )
}
