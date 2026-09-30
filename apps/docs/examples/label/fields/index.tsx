import { useState } from 'react'
import { FieldDescription, FieldError, TextField } from '@/components/ui/text-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// Inside a TextField, the Label is linked to the input with no `htmlFor`:
// clicking it focuses the field and screen readers announce it as the name.
// TextField carries the `group` class, so a disabled field dims its label too.
export default function Fields() {
  const [email, setEmail] = useState('brett@')
  const valid = /^\S+@\S+\.\S+$/.test(email)

  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <TextField defaultValue="Brett Lamy">
        <Label variant="field">Display name</Label>
        <Input />
      </TextField>

      <TextField value={email} onChange={setEmail} isInvalid={!valid} isRequired type="email">
        <Label variant="field">Email</Label>
        <Input />
        <FieldDescription>Receipts and sign-in links go here.</FieldDescription>
        <FieldError>Enter a full address, such as name@example.com.</FieldError>
      </TextField>

      <TextField defaultValue="brett.lamy" isDisabled>
        <Label variant="field">Username</Label>
        <Input />
      </TextField>

      <TextField defaultValue="Default variant">
        <Label>The default variant, 15px</Label>
        <Input />
      </TextField>
    </div>
  )
}
