import { I18nProvider } from 'react-aria-components'
import { parseDateTime, Time } from '@internationalized/date'
import { DateField, DateInput, TimeField } from '@/components/ui/date-field'
import { Label } from '@/components/ui/label'

// TimeField edits a time of day (a `Time`); a DateField with a `granularity`
// finer than a day edits a date and a time (a `CalendarDateTime`). Values are
// fixed so the demo reads the same for everyone; the locale decides the
// 12- or 24-hour clock unless `hourCycle` says otherwise.
export default function WithTime() {
  return (
    <I18nProvider locale="en-US">
      <div className="mx-auto grid max-w-sm gap-5">
        <TimeField defaultValue={new Time(9, 30)}>
          <Label variant="field">Alarm</Label>
          <DateInput />
        </TimeField>

        <TimeField defaultValue={new Time(14, 45, 10)} hourCycle={24} granularity="second">
          <Label variant="field">Departure (24-hour, with seconds)</Label>
          <DateInput />
        </TimeField>

        <DateField granularity="minute" defaultValue={parseDateTime('2026-09-09T09:30')}>
          <Label variant="field">Starts</Label>
          <DateInput />
        </DateField>
      </div>
    </I18nProvider>
  )
}
