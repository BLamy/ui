import { I18nProvider } from 'react-aria-components'
import { parseDate } from '@internationalized/date'
import { Calendar } from '@/components/ui/calendar'

// Days outside minValue..maxValue are dimmed and cannot be focused or picked,
// and the previous / next buttons stop at the edge of the allowed range.
// The bounds are fixed dates so the demo is the same for everyone; in an app
// they usually come from `today(getLocalTimeZone())`.
export default function MinMax() {
  return (
    <I18nProvider locale="en-US">
      <div className="mx-auto w-fit">
        <Calendar
          aria-label="Delivery date"
          variant="card"
          defaultValue={parseDate('2026-09-15')}
          minValue={parseDate('2026-09-08')}
          maxValue={parseDate('2026-09-24')}
        />
      </div>
    </I18nProvider>
  )
}
