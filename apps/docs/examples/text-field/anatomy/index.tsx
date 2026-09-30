import { FieldDescription, FieldError, TextField } from '@/components/ui/text-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

// TextField is the wrapper: it links the Label, the control, the description
// and the error by id, so a screen reader announces them together. The control
// inside is an Input or a Textarea.
export default function Anatomy() {
  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <TextField defaultValue="brett@replay.example" type="email">
        <Label variant="field">Email</Label>
        <Input />
        <FieldDescription>Used for sign-in and receipts.</FieldDescription>
      </TextField>
      <TextField isInvalid defaultValue="br">
        <Label variant="field">Username</Label>
        <Input />
        <FieldError>Usernames need at least 3 characters.</FieldError>
      </TextField>
      <TextField>
        <Label variant="field">Bio</Label>
        <Textarea size="sm" placeholder="A few words about you" />
      </TextField>
      <TextField isDisabled defaultValue="Team plan">
        <Label variant="field">Plan</Label>
        <Input />
        <FieldDescription>Ask an owner to change it.</FieldDescription>
      </TextField>
    </div>
  )
}
