import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldError, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Radio, RadioGroup } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'

// A native form: required / type / pattern failures block the submit and show
// in each field's FieldError. A server's answer is yours to show: here the
// address "taken@example.com" is rejected after a pretend round trip, the
// field is marked `invalid` with the message, and editing it clears the error.
export default function Signup() {
  const [taken, setTaken] = useState('')
  const [done, setDone] = useState<string | null>(null)
  return (
    <div className="mx-auto max-w-sm">
      <Form
        onSubmit={(e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          const email = String(data.get('email'))
          if (email === 'taken@example.com') {
            setTaken('That address is already registered.')
            setDone(null)
          } else {
            setTaken('')
            setDone(email)
          }
        }}
      >
        <FieldSet>
          <FieldLegend>Account</FieldLegend>
          <Field name="name">
            <FieldLabel variant="field">Full name</FieldLabel>
            <Input required autoComplete="name" defaultValue="Jane Appleseed" />
            <FieldError />
          </Field>
          <Field name="email" invalid={taken ? true : undefined}>
            <FieldLabel variant="field">Email</FieldLabel>
            <Input type="email" required placeholder="you@example.com" autoComplete="email" defaultValue="taken@example.com" onValueChange={() => setTaken('')} />
            <FieldDescription>Try it as is, then change it.</FieldDescription>
            <FieldError>{(state) => taken || state.message}</FieldError>
          </Field>
        </FieldSet>
        <FieldSet>
          <FieldLegend>Preferences</FieldLegend>
          <Field name="plan">
            <FieldLabel variant="field">Plan</FieldLabel>
            <RadioGroup defaultValue="free">
              <Label variant="control"><Radio value="free" />Free</Label>
              <Label variant="control"><Radio value="pro" />Pro · $8 / month</Label>
            </RadioGroup>
          </Field>
          <Field name="about">
            <FieldLabel variant="field">About you</FieldLabel>
            <Textarea size="sm" placeholder="Optional" />
          </Field>
          <Label variant="control"><Checkbox name="terms" required />I agree to the Terms</Label>
          <FieldDescription>You can change these later in Settings.</FieldDescription>
        </FieldSet>
        <Button type="submit" size="pill">Create account</Button>
        {done ? <p className="m-0 text-center text-footnote text-success">Welcome, {done}.</p> : null}
      </Form>
    </div>
  )
}
