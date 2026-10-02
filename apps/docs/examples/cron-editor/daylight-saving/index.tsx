import { CronEditor } from '@/components/ui/cron-editor'

// Next runs are computed in `timeZone` (default: the device's), not UTC.
// In New York the clock jumps from 02:00 to 03:00 on 8 March 2026, so a job
// at 02:30 has no 02:30 that day: it runs at 03:30, as cron does for a
// fixed-time job. A job that follows the clock (`*/30 1-3 * * *`) simply has
// no 02:xx.
export default function DaylightSaving() {
  return (
    <div className="mx-auto max-w-md">
      <CronEditor
        naturalLanguage={false}
        presets={[
          { label: 'At 02:30', value: '30 2 * * *' },
          { label: 'Every 30 min, 01:00–03:59', value: '*/30 1-3 * * *' },
        ]}
        defaultValue="30 2 * * *"
        from="2026-03-06T12:00:00Z"
        timeZone="America/New_York"
        locale="en-US"
        nextRunCount={4}
      />
    </div>
  )
}
