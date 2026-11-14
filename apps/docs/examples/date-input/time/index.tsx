import { DateInput, TimeInput } from '@/components/ui/date-input'
import { Field, FieldLabel } from '@/components/ui/field'

// TimeInput edits a time of day: its value is 24-hour ("14:45") whatever clock
// it shows. A DateInput with a `granularity` finer than a day edits a date and a
// time ("2026-09-09T09:30"). Values are fixed so the demo reads the same for
// everyone; the locale decides the 12- or 24-hour clock unless `hourCycle` says
// otherwise.
export default function WithTime() {
  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <Field>
        <FieldLabel>Alarm</FieldLabel>
        <TimeInput locale="en-US" defaultValue="09:30" />
      </Field>

      <Field>
        <FieldLabel>Departure (24-hour, with seconds)</FieldLabel>
        <TimeInput locale="en-US" hourCycle={24} granularity="second" defaultValue="14:45:10" />
      </Field>

      <Field>
        <FieldLabel>Starts</FieldLabel>
        <DateInput locale="en-US" granularity="minute" defaultValue="2026-09-09T09:30" />
      </Field>
    </div>
  )
}
