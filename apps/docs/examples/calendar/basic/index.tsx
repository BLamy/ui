import { useState } from 'react'
import { I18nProvider, type DateValue } from 'react-aria-components'
import { parseDate } from '@internationalized/date'
import { Calendar } from '@/components/ui/calendar'

// The locale and the dates are pinned (September 2026, en-US) so the demo reads
// the same for everyone. In an app, leave the I18nProvider out and the calendar
// follows the browser's locale, and start from `today(getLocalTimeZone())`.
export default function Basic() {
  const [date, setDate] = useState<DateValue | null>(parseDate('2026-09-09'))
  return (
    <I18nProvider locale="en-US">
      <div className="mx-auto grid w-fit gap-3">
        <Calendar
          aria-label="Appointment date"
          variant="card"
          value={date}
          onChange={setDate}
          defaultFocusedValue={parseDate('2026-09-09')}
        />
        <p className="m-0 px-1 text-footnote text-foreground/70">
          Selected: <code>{date ? date.toString() : 'nothing'}</code>
        </p>
      </div>
    </I18nProvider>
  )
}
