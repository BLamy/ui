import { Calendar, type DateMatchers } from '@/components/ui/calendar'

// `unavailable` is data: single dates, `{ from, to }` spans, weekdays (0 is
// Sunday), `{ before }` / `{ after }`, or a function of the ISO date.
const closed: DateMatchers = [{ weekday: [0, 6] }, '2026-09-07', '2026-09-21']

// An unavailable day is struck through in red and cannot be picked, but unlike
// a day outside `min` and `max` it can still be reached with the arrow keys, so
// a keyboard user hears why.
export default function Unavailable() {
  return (
    <div className="mx-auto w-fit">
      <Calendar variant="card" locale="en-US" defaultValue="2026-09-09" unavailable={closed} />
    </div>
  )
}
