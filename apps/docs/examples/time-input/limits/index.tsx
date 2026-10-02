import { TimeInput } from '@/components/ui/time-input'

// gpu-time is a small model and sometimes resolves a wrong date without any
// warning: "at 1930" is read as the year 1930, and "before 6pm" as 6pm itself.
// This is why the preview lists the resolved dates in full: the person typing
// can see the mistake, and your code should not trust the result unreviewed.
export default function Limits() {
  const pinned = { reference: '2026-09-09T12:00:00+06:00', timeZone: 'Asia/Dhaka', locale: 'en-US' }
  return (
    <div className="mx-auto grid max-w-md gap-5">
      <TimeInput label="A time written as 1930" defaultValue="at 1930" {...pinned} />
      <TimeInput label="An upper bound" defaultValue="before 6pm friday" {...pinned} />
    </div>
  )
}
