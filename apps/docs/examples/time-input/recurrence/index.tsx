import { TimeInput } from '@/components/ui/time-input'

// A repeating schedule gets a "Repeats" chip (the RRULE in words; the raw rule
// is its tooltip) and a short list of upcoming occurrences. `maxOccurrences`
// sets how many are listed; `showBackend` labels which backend parsed the text.
export default function Recurrence() {
  return (
    <div className="mx-auto max-w-md">
      <TimeInput
        label="Repeats"
        description="Try “every other tuesday”, “the first monday of every month at 10am” or “every 2 hours”."
        defaultValue="every weekday at 9am"
        maxOccurrences={4}
        showBackend
        reference="2026-09-09T12:00:00+06:00"
        timeZone="Asia/Dhaka"
        locale="en-US"
      />
    </div>
  )
}
