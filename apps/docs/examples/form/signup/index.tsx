import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormSection } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Radio, RadioGroup } from '@/components/ui/radio-group'
import { FieldDescription, FieldError, TextField } from '@/components/ui/text-field'
import { Textarea } from '@/components/ui/textarea'

// Form validates natively on submit: required / type / pattern failures block
// the submit and show each field's FieldError. `validationErrors` maps a
// server response onto fields by `name` — here the address "taken@example.com"
// is rejected after a pretend round trip, and it clears once the field is edited and blurred.
export default function Signup() {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [done, setDone] = useState<string | null>(null)
  return (
    <div className="mx-auto max-w-sm">
      <Form
        validationErrors={errors}
        onSubmit={(e) => {
          e.preventDefault()
          const data = new FormData(e.currentTarget)
          const email = String(data.get('email'))
          if (email === 'taken@example.com') {
            setErrors({ email: 'That address is already registered.' })
            setDone(null)
          } else {
            setErrors({})
            setDone(email)
          }
        }}
      >
        <FormSection title="Account">
          <TextField name="name" isRequired defaultValue="Jane Appleseed">
            <Label variant="field">Full name</Label>
            <Input autoComplete="name" />
            <FieldError />
          </TextField>
          <TextField name="email" type="email" isRequired defaultValue="taken@example.com">
            <Label variant="field">Email</Label>
            <Input placeholder="you@example.com" autoComplete="email" />
            <FieldDescription>Try it as is, then change it.</FieldDescription>
            <FieldError />
          </TextField>
        </FormSection>
        <FormSection title="Preferences" description="You can change these later in Settings.">
          <RadioGroup name="plan" defaultValue="free">
            <Label variant="field">Plan</Label>
            <Radio value="free">Free</Radio>
            <Radio value="pro">Pro · $8 / month</Radio>
          </RadioGroup>
          <TextField name="about">
            <Label variant="field">About you</Label>
            <Textarea size="sm" placeholder="Optional" />
          </TextField>
          <Checkbox name="terms" isRequired>I agree to the Terms</Checkbox>
        </FormSection>
        <Button type="submit" size="pill">Create account</Button>
        {done ? <p className="m-0 text-center text-footnote text-success">Welcome, {done}.</p> : null}
      </Form>
    </div>
  )
}
