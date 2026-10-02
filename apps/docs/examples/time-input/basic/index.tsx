import { TimeInput } from '@/components/ui/time-input'

// "Now" and the time zone are pinned here so the demo reads the same for
// everyone (Wednesday 9 September 2026, in Dhaka). In an app, leave both out:
// the text is then read against the moment of typing, in the browser's zone.
export default function Basic() {
  return (
    <div className="mx-auto max-w-md">
      <TimeInput
        label="When"
        description="Try “tomorrow at 3pm”, “3 Mar 2027 at noon” or “friday after 6pm”."
        defaultValue="Sat Sun 1pm-8pm Mon 10pm-12am"
        reference="2026-09-09T12:00:00+06:00"
        timeZone="Asia/Dhaka"
        locale="en-US"
      />
    </div>
  )
}
