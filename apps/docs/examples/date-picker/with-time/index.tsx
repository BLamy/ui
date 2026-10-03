import { useState } from 'react'
import { I18nProvider, type DateValue } from 'react-aria-components'
import { parseDateTime } from '@internationalized/date'
import { DatePicker, DatePickerContent, DatePickerField } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { FieldDescription } from '@/components/ui/text-field'
import { ThemeScope } from '@/lib/theme'

// A `granularity` finer than a day adds the time segments to the field; the
// calendar then picks the day and keeps the time you typed. The value is a
// CalendarDateTime, pinned so the demo reads the same for everyone.
export default function WithTime() {
  const [starts, setStarts] = useState<DateValue | null>(parseDateTime('2026-09-09T09:30'))
  // The ThemeScope is only here so the portalled popover wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <I18nProvider locale="en-US">
      <ThemeScope className="mx-auto grid max-w-sm gap-5">
        <DatePicker granularity="minute" value={starts} onChange={setStarts}>
          <Label variant="field">Starts</Label>
          <DatePickerField />
          <FieldDescription>{starts ? starts.toString() : 'Pick a day and a time.'}</FieldDescription>
          <DatePickerContent />
        </DatePicker>
      </ThemeScope>
    </I18nProvider>
  )
}
