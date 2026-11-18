import { Calendar } from '@/components/ui/calendar'

// Days outside min..max are dimmed and cannot be picked, the arrow keys stop at
// them, and the previous / next buttons stop at the edge of the allowed range.
// The bounds are fixed dates so the demo is the same for everyone; in an app
// they usually come from `todayDate()` and `addDays()` in `@brett_lamy/ui/sdk/core/date`.
export default function MinMax() {
  return (
    <div className="mx-auto w-fit">
      <Calendar
        variant="card"
        locale="en-US"
        defaultValue="2026-09-15"
        min="2026-09-08"
        max="2026-09-24"
      />
    </div>
  )
}
