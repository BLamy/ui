import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// Field is the wrapper: it links the label, the control, the description and
// the error by id, so a screen reader announces them together. The control
// inside is an Input or a Textarea, and keeps its own value and attributes.
export default function Anatomy() {
  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <Field name="email">
        <FieldLabel>Email</FieldLabel>
        <Input type="email" defaultValue="brett@replay.example" />
        <FieldDescription>Used for sign-in and receipts.</FieldDescription>
      </Field>
      <Field name="username" invalid>
        <FieldLabel>Username</FieldLabel>
        <Input defaultValue="br" />
        <FieldError match>Usernames need at least 3 characters.</FieldError>
      </Field>
      <Field name="bio">
        <FieldLabel>Bio</FieldLabel>
        <Textarea size="sm" placeholder="A few words about you" />
      </Field>
      <Field name="plan" disabled>
        <FieldLabel>Plan</FieldLabel>
        <Input defaultValue="Team plan" />
        <FieldDescription>Ask an owner to change it.</FieldDescription>
      </Field>
    </div>
  )
}
