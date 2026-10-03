import { useState } from 'react'
import { I18nProvider, type DateValue, type RangeValue } from 'react-aria-components'
import { parseDate } from '@internationalized/date'
import {
  DateRangePicker,
  DateRangePickerContent,
  DateRangePickerField,
} from '@/components/ui/date-picker'
import { Label } from '@/components/ui/label'
import { FieldDescription } from '@/components/ui/text-field'
import { ThemeScope } from '@/lib/theme'

// Pinned to September 2026 in en-US. The popover shows two months side by side
// through `calendarProps`, and closes once the end of the range is chosen.
export default function Range() {
  const [stay, setStay] = useState<RangeValue<DateValue> | null>({
    start: parseDate('2026-09-08'),
    end: parseDate('2026-09-13'),
  })
  // The ThemeScope is only here so the portalled popover wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <I18nProvider locale="en-US">
      <ThemeScope className="mx-auto grid max-w-sm gap-5">
        <DateRangePicker value={stay} onChange={setStay}>
          <Label variant="field">Stay</Label>
          <DateRangePickerField />
          <FieldDescription>Check-in to check-out.</FieldDescription>
          <DateRangePickerContent
            calendarProps={{ visibleMonths: 2, defaultFocusedValue: parseDate('2026-09-08') }}
          />
        </DateRangePicker>
      </ThemeScope>
    </I18nProvider>
  )
}
