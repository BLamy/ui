import { useState } from 'react'
import { DateInput } from '@/components/ui/date-input'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'

// The locale and the date are pinned so the demo reads the same for everyone
// (en-US: month, day, year). In an app, leave `locale` out and the field follows
// the page's language: a de-DE visitor gets day.month.year, with their own
// separators. The value is an ISO date, and `null` until every part is filled.
export default function Basic() {
  const [date, setDate] = useState<string | null>('2026-09-09')
  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <Field>
        <FieldLabel>Birthday</FieldLabel>
        <DateInput locale="en-US" value={date} onValueChange={setDate} />
        <FieldDescription>
          Click a part, then type digits or press the arrow keys. Selected:{' '}
          {date ?? 'incomplete'}
        </FieldDescription>
      </Field>

      <DateInput aria-label="Due, small" locale="en-US" size="sm" defaultValue="2026-09-09" />

      <Field disabled>
        <FieldLabel>Locked by an admin</FieldLabel>
        <DateInput locale="en-US" defaultValue="2026-09-09" />
      </Field>
    </div>
  )
}
