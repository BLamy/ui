import { useState } from 'react'
import { daysBetween } from '@ui-sdk/core/date'
import { Calendar, type CalendarValue } from '@/components/ui/calendar'

// Pinned to September 2026 in en-US so the demo reads the same for everyone.
// A range is a `[start, end]` pair of ISO dates, or `null`.
export default function Range() {
  const [stay, setStay] = useState<CalendarValue<'range'>>(['2026-09-08', '2026-09-13'])
  const nights = stay ? daysBetween(stay[0], stay[1]) : 0
  return (
    <div className="mx-auto grid w-fit gap-3">
      <Calendar
        mode="range"
        variant="card"
        locale="en-US"
        defaultMonth="2026-09"
        value={stay}
        onValueChange={setStay}
      />
      <p className="m-0 px-1 text-footnote text-foreground/70">
        {stay
          ? `${stay[0]} to ${stay[1]} · ${nights} night${nights === 1 ? '' : 's'}`
          : 'Pick a check-in day, then a check-out day.'}
      </p>
    </div>
  )
}
