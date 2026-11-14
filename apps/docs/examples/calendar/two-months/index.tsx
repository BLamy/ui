import { useState } from 'react'
import { Calendar, type CalendarValue } from '@/components/ui/calendar'

// `months` shows that many months side by side, each in its own grid; the arrow
// keys cross from one to the next. `pageBy="page"` makes previous / next turn
// both months at once. A range may span the months, as here (24 September to
// 6 October 2026). Pinned so the demo reads the same for everyone.
export default function TwoMonths() {
  const [trip, setTrip] = useState<CalendarValue<'range'>>(['2026-09-24', '2026-10-06'])
  return (
    <div className="mx-auto w-fit max-w-full overflow-x-auto">
      <Calendar
        mode="range"
        variant="card"
        months={2}
        pageBy="page"
        locale="en-US"
        defaultMonth="2026-09"
        value={trip}
        onValueChange={setTrip}
      />
    </div>
  )
}
