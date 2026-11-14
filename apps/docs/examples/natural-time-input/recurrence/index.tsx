import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { NaturalTimeInput } from '@/components/ui/natural-time-input'

// A repeating schedule gets a "Repeats" chip (the RRULE in words; the raw rule
// is its tooltip) and a short list of upcoming occurrences. `maxOccurrences`
// sets how many are listed; `showBackend` labels which backend parsed the text.
export default function Recurrence() {
  return (
    <div className="mx-auto max-w-md">
      <Field>
        <FieldLabel>Repeats</FieldLabel>
        <NaturalTimeInput
          defaultValue="every weekday at 9am"
          maxOccurrences={4}
          showBackend
          reference="2026-09-09T12:00:00+06:00"
          timeZone="Asia/Dhaka"
          locale="en-US"
        />
        <FieldDescription>Try “every other tuesday”, “the first monday of every month at 10am” or “every 2 hours”.</FieldDescription>
      </Field>
    </div>
  )
}
