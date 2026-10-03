import { useState } from 'react'
import { I18nProvider, type DateValue, type RangeValue } from 'react-aria-components'
import { parseDate } from '@internationalized/date'
import { RangeCalendar } from '@/components/ui/calendar'

// `visibleMonths` shows up to three months side by side; the previous / next
// buttons move by that many months. A range may span the months, as here
// (24 September to 6 October 2026). Pinned so the demo reads the same for everyone.
export default function TwoMonths() {
  const [trip, setTrip] = useState<RangeValue<DateValue> | null>({
    start: parseDate('2026-09-24'),
    end: parseDate('2026-10-06'),
  })
  return (
    <I18nProvider locale="en-US">
      <div className="mx-auto w-fit max-w-full overflow-x-auto">
        <RangeCalendar
          aria-label="Trip"
          variant="card"
          visibleMonths={2}
          value={trip}
          onChange={setTrip}
          defaultFocusedValue={parseDate('2026-09-24')}
        />
      </div>
    </I18nProvider>
  )
}
