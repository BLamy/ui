import { useState } from 'react'
import {
  DatePicker,
  DatePickerContent,
  DatePickerInputGroup,
  DatePickerInput,
  DatePickerTrigger,
} from '@/components/ui/date-picker'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { ThemeScope } from '@/lib/theme'

// Pinned to September 2026 in en-US so the demo reads the same for everyone.
// With no value, `defaultMonth` decides which month the popup opens on; leave
// it out and it opens on today.
export default function Basic() {
  const [date, setDate] = useState<string | null>('2026-09-09')
  // The ThemeScope is only here so the popup wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm gap-5">
      <Field>
        <FieldLabel>Date</FieldLabel>
        <DatePicker locale="en-US" value={date} onValueChange={setDate}>
          <DatePickerInputGroup />
          <DatePickerContent />
        </DatePicker>
        <FieldDescription>
          Type a date, or open the calendar. Selected: {date ?? 'nothing'}
        </FieldDescription>
      </Field>

      <DatePicker locale="en-US" defaultMonth="2026-09">
        <DatePickerInputGroup size="sm">
          <DatePickerInput aria-label="Due, small" placeholder="Due" />
          <DatePickerTrigger />
        </DatePickerInputGroup>
        <DatePickerContent />
      </DatePicker>
    </ThemeScope>
  )
}
