import { useState } from 'react'
import { I18nProvider, type DateValue } from 'react-aria-components'
import { parseDate } from '@internationalized/date'
import { DateField, DateInput } from '@/components/ui/date-field'
import { Label } from '@/components/ui/label'
import { FieldDescription, FieldError } from '@/components/ui/text-field'

// With `validationBehavior="aria"` the field validates live: `minValue`,
// `maxValue` and your own `validate` all feed the same FieldError. The bounds
// are fixed dates (not "today") so the demo reads the same for everyone.
export default function Validation() {
  const [date, setDate] = useState<DateValue | null>(parseDate('2026-08-20'))
  return (
    <I18nProvider locale="en-US">
      <div className="mx-auto grid max-w-sm gap-5">
        <DateField
          value={date}
          onChange={setDate}
          validationBehavior="aria"
          minValue={parseDate('2026-09-01')}
          maxValue={parseDate('2026-12-31')}
          isRequired
        >
          <Label variant="field">Check-in</Label>
          <DateInput />
          <FieldDescription>Between 1 September and 31 December 2026.</FieldDescription>
          <FieldError />
        </DateField>

        <DateField
          defaultValue={parseDate('2026-09-12')}
          validationBehavior="aria"
          validate={(d) =>
            d && d.toDate('UTC').getUTCDay() === 6 ? 'We do not deliver on Saturdays.' : null
          }
        >
          <Label variant="field">Delivery</Label>
          <DateInput />
          <FieldError />
        </DateField>
      </div>
    </I18nProvider>
  )
}
