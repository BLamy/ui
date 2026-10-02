import { TimeInput } from '@/components/ui/time-input'

// An ambiguous numeric date is month-first ("MDY") unless `dateOrder="DMY"`.
// Named months and year-first dates read the same either way.
export default function DateOrder() {
  const pinned = { reference: '2026-09-09T12:00:00+06:00', timeZone: 'Asia/Dhaka', locale: 'en-US' }
  return (
    <div className="mx-auto grid max-w-md gap-5">
      <TimeInput label="Month first (default)" defaultValue="dinner on 3/4" {...pinned} />
      <TimeInput label="Day first" dateOrder="DMY" defaultValue="dinner on 3/4" {...pinned} />
    </div>
  )
}
