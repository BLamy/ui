import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { DatePicker, DatePickerContent, DatePickerField } from '@/components/ui/date-picker'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Form } from '@/components/ui/form'
import { ThemeScope } from '@/lib/theme'

// A `name` (the Field's, or the picker's own) makes the picker submit its value
// in FormData as an ISO date; a range submits `startName` and `endName`.
// `required` blocks the submit until it is filled, text that is not a date
// blocks it too, and the FieldError shows the message.
export default function FormDemo() {
  const [sent, setSent] = useState<string | null>(null)
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setSent(JSON.stringify(Object.fromEntries(data), null, 2))
  }
  // The ThemeScope is only here so the popups wear this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto max-w-sm">
      <Form onSubmit={onSubmit}>
        <Field name="due">
          <FieldLabel variant="field">Due date</FieldLabel>
          <DatePicker locale="en-US" required min="2026-09-01" defaultMonth="2026-09">
            <DatePickerField />
            <DatePickerContent />
          </DatePicker>
          <FieldDescription>Required, from 1 September 2026.</FieldDescription>
          <FieldError />
        </Field>

        <Field>
          <FieldLabel variant="field">Stay</FieldLabel>
          <DatePicker
            mode="range"
            locale="en-US"
            startName="from"
            endName="to"
            defaultValue={['2026-09-08', '2026-09-13']}
          >
            <DatePickerField />
            <DatePickerContent />
          </DatePicker>
        </Field>

        <Button type="submit" size="pill">
          Save
        </Button>
      </Form>
      {sent ? <pre className="mt-4 mb-0 rounded-ctl bg-secondary p-3 text-footnote">{sent}</pre> : null}
    </ThemeScope>
  )
}
