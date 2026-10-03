import { useState } from 'react'
import { I18nProvider, type DateValue } from 'react-aria-components'
import { parseDate } from '@internationalized/date'
import { DatePicker, DatePickerContent, DatePickerField } from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { FieldDescription } from '@/components/ui/text-field'
import { ThemeScope } from '@/lib/theme'

// Pinned to September 2026 in en-US so the demo reads the same for everyone.
// With no value, `calendarProps.defaultFocusedValue` decides which month opens;
// leave it out and it opens on today.
export default function Basic() {
  const [date, setDate] = useState<DateValue | null>(parseDate('2026-09-09'))
  // The ThemeScope is only here so the portalled popover wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <I18nProvider locale="en-US">
      <ThemeScope className="mx-auto grid max-w-sm gap-5">
        <DatePicker value={date} onChange={setDate}>
          <Label variant="field">Date</Label>
          <DatePickerField />
          <FieldDescription>
            Type a date, or open the calendar. Selected: {date ? date.toString() : 'nothing'}
          </FieldDescription>
          <DatePickerContent calendarProps={{ defaultFocusedValue: parseDate('2026-09-09') }} />
        </DatePicker>

        <DatePicker aria-label="Due, small">
          <DatePickerField size="sm" />
          <DatePickerContent calendarProps={{ defaultFocusedValue: parseDate('2026-09-09') }} />
        </DatePicker>
      </ThemeScope>
    </I18nProvider>
  )
}
