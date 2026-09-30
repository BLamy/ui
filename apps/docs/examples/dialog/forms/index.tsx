import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FieldError, TextField } from '@/components/ui/text-field'
import { BLProvider } from '@/lib/theme'

// `default` (400px) and `lg` (560px) are general dialogs: header, a scrolling
// body, a right-aligned footer, a round × in the corner. The render-function
// child receives `close`, so Save can validate before it dismisses.
export default function Forms() {
  const [name, setName] = useState('Aurora redesign')
  const [draft, setDraft] = useState(name)
  const empty = draft.trim() === ''
  return (
    <div className="mx-auto h-96 max-w-lg overflow-hidden rounded-card shadow-hairline">
      <BLProvider>
        <div className="grid h-full content-start gap-3 p-5">
          <div className="text-body">
            Project: <strong>{name}</strong>
          </div>
          <div>
            <DialogTrigger onOpenChange={(open) => open && setDraft(name)}>
              <Button variant="secondary">Rename…</Button>
              <DialogContent>
                {({ close }) => (
                  <>
                    <DialogClose />
                    <DialogHeader>
                      <DialogTitle>Rename project</DialogTitle>
                      <DialogDescription>
                        Names are visible to everyone in the workspace.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogBody>
                      <TextField
                        value={draft}
                        onChange={setDraft}
                        isInvalid={empty}
                        autoFocus
                      >
                        <Label variant="field">Name</Label>
                        <Input />
                        <FieldError>A project needs a name.</FieldError>
                      </TextField>
                    </DialogBody>
                    <DialogFooter>
                      <Button variant="ghost" onPress={close}>Cancel</Button>
                      <Button
                        isDisabled={empty}
                        onPress={() => {
                          setName(draft.trim())
                          close()
                        }}
                      >
                        Save
                      </Button>
                    </DialogFooter>
                  </>
                )}
              </DialogContent>
            </DialogTrigger>
          </div>
        </div>
      </BLProvider>
    </div>
  )
}
