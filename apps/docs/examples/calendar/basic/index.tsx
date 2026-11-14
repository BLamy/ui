import { useState } from 'react'
import { Calendar, type CalendarValue } from '@/components/ui/calendar'

// The locale, the month on show and the date are pinned (September 2026, en-US)
// so the demo reads the same for everyone. In an app, leave `locale` and
// `defaultMonth` out: the calendar follows the page's language and opens on the
// value's month, or on today.
export default function Basic() {
  const [date, setDate] = useState<CalendarValue<'single'>>('2026-09-09')
  return (
    <div className="mx-auto grid w-fit gap-3">
      <Calendar
        variant="card"
        locale="en-US"
        defaultMonth="2026-09"
        value={date}
        onValueChange={setDate}
      />
      <p className="m-0 px-1 text-footnote text-foreground/70">
        Selected: <code>{date ?? 'nothing'}</code>
      </p>
    </div>
  )
}
