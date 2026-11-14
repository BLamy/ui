import { useState } from 'react'
import { TimeField } from '@/components/ui/date-field'
import { DatePicker, DatePickerContent, DatePickerField } from '@/components/ui/date-picker'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { ThemeScope } from '@/lib/theme'

// A DatePicker holds a date only. For a date and a time, put a TimeField beside
// it and join the two yourself: both are ISO strings, so the local date-time is
// `${date}T${time}`. Values are pinned so the demo reads the same for everyone.
export default function WithTime() {
  const [date, setDate] = useState<string | null>('2026-09-09')
  const [time, setTime] = useState<string | null>('09:30')
  const starts = date && time ? `${date}T${time}` : null
  // The ThemeScope is only here so the popup wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm gap-1.5">
      <div className="flex items-end gap-2">
        <Field className="min-w-0 flex-1">
          <FieldLabel>Starts</FieldLabel>
          <DatePicker locale="en-US" value={date} onValueChange={setDate}>
            <DatePickerField />
            <DatePickerContent />
          </DatePicker>
        </Field>
        <TimeField
          aria-label="Start time"
          locale="en-US"
          className="w-auto"
          value={time}
          onValueChange={setTime}
        />
      </div>
      <FieldDescription>{starts ?? 'Pick a day and a time.'}</FieldDescription>
    </ThemeScope>
  )
}
