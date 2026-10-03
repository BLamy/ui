import { useState } from 'react'
import { I18nProvider, type DateValue, type RangeValue } from 'react-aria-components'
import { parseDate } from '@internationalized/date'
import { RangeCalendar } from '@/components/ui/calendar'

// Pinned to September 2026 in en-US so the demo reads the same for everyone.
export default function Range() {
  const [stay, setStay] = useState<RangeValue<DateValue> | null>({
    start: parseDate('2026-09-08'),
    end: parseDate('2026-09-13'),
  })
  const nights = stay ? stay.end.compare(stay.start) : 0
  return (
    <I18nProvider locale="en-US">
      <div className="mx-auto grid w-fit gap-3">
        <RangeCalendar
          aria-label="Stay"
          variant="card"
          value={stay}
          onChange={setStay}
          defaultFocusedValue={parseDate('2026-09-08')}
        />
        <p className="m-0 px-1 text-footnote text-foreground/70">
          {stay
            ? `${stay.start.toString()} to ${stay.end.toString()} · ${nights} night${nights === 1 ? '' : 's'}`
            : 'Pick a check-in day, then a check-out day.'}
        </p>
      </div>
    </I18nProvider>
  )
}
