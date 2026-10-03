import { useState, type FormEvent } from 'react'
import { I18nProvider } from 'react-aria-components'
import { parseDate } from '@internationalized/date'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import {
  DatePicker,
  DatePickerContent,
  DatePickerField,
  DateRangePicker,
  DateRangePickerContent,
  DateRangePickerField,
} from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { FieldDescription, FieldError } from '@/components/ui/text-field'
import { ThemeScope } from '@/lib/theme'

// A `name` makes the picker submit its value in FormData as an ISO string
// (a range submits `startName` and `endName`). `isRequired` blocks the submit
// until it is filled, and the FieldError shows the browser's message.
export default function FormDemo() {
  const [sent, setSent] = useState<string | null>(null)
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    setSent(JSON.stringify(Object.fromEntries(data), null, 2))
  }
  // The ThemeScope is only here so the portalled popovers wear this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <I18nProvider locale="en-US">
      <ThemeScope className="mx-auto max-w-sm">
        <Form onSubmit={onSubmit}>
          <DatePicker name="due" isRequired minValue={parseDate('2026-09-01')}>
            <Label variant="field">Due date</Label>
            <DatePickerField />
            <FieldDescription>Required, from 1 September 2026.</FieldDescription>
            <FieldError />
            <DatePickerContent calendarProps={{ defaultFocusedValue: parseDate('2026-09-09') }} />
          </DatePicker>

          <DateRangePicker startName="from" endName="to" defaultValue={{ start: parseDate('2026-09-08'), end: parseDate('2026-09-13') }}>
            <Label variant="field">Stay</Label>
            <DateRangePickerField />
            <DateRangePickerContent />
          </DateRangePicker>

          <Button type="submit" size="pill">
            Save
          </Button>
        </Form>
        {sent ? <pre className="mt-4 mb-0 rounded-ctl bg-secondary p-3 text-footnote">{sent}</pre> : null}
      </ThemeScope>
    </I18nProvider>
  )
}
