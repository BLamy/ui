import { useState } from 'react'
import { I18nProvider, type DateValue } from 'react-aria-components'
import { parseDate } from '@internationalized/date'
import { DateField, DateInput } from '@/components/ui/date-field'
import { Label } from '@/components/ui/label'
import { FieldDescription } from '@/components/ui/text-field'

// The locale and the date are pinned so the demo reads the same for everyone
// (en-US: month, day, year). In an app the field follows the browser's locale:
// a de-DE visitor gets day.month.year, with their own separators.
export default function Basic() {
  const [date, setDate] = useState<DateValue | null>(parseDate('2026-09-09'))
  return (
    <I18nProvider locale="en-US">
      <div className="mx-auto grid max-w-sm gap-5">
        <DateField value={date} onChange={setDate}>
          <Label variant="field">Birthday</Label>
          <DateInput />
          <FieldDescription>
            Click a part, then type digits or press the arrow keys. Selected:{' '}
            {date ? date.toString() : 'incomplete'}
          </FieldDescription>
        </DateField>

        <DateField aria-label="Due, small" defaultValue={parseDate('2026-09-09')}>
          <DateInput size="sm" />
        </DateField>

        <DateField isDisabled defaultValue={parseDate('2026-09-09')}>
          <Label variant="field">Locked by an admin</Label>
          <DateInput />
        </DateField>
      </div>
    </I18nProvider>
  )
}
