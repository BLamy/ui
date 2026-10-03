import { I18nProvider, type DateValue } from 'react-aria-components'
import { isWeekend, parseDate } from '@internationalized/date'
import { Calendar } from '@/components/ui/calendar'

const holidays = new Set(['2026-09-07', '2026-09-21'])

// An unavailable day is struck through in red and cannot be picked, but unlike
// a disabled day it can still be reached with the arrow keys, so a keyboard
// user hears why. If a selected value lands on one, the calendar is invalid.
export default function Unavailable() {
  const isDateUnavailable = (date: DateValue) =>
    isWeekend(date, 'en-US') || holidays.has(date.toString())
  return (
    <I18nProvider locale="en-US">
      <div className="mx-auto w-fit">
        <Calendar
          aria-label="Pickup date"
          variant="card"
          defaultValue={parseDate('2026-09-09')}
          isDateUnavailable={isDateUnavailable}
        />
      </div>
    </I18nProvider>
  )
}
