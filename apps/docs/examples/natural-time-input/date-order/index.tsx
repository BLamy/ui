import { Field, FieldLabel } from '@/components/ui/field'
import { NaturalTimeInput } from '@/components/ui/natural-time-input'

// An ambiguous numeric date is month-first ("MDY") unless `parse={{ dateOrder: 'DMY' }}`.
// Named months and year-first dates read the same either way.
export default function DateOrder() {
  const pinned = { reference: '2026-09-09T12:00:00+06:00', timeZone: 'Asia/Dhaka', locale: 'en-US' }
  return (
    <div className="mx-auto grid max-w-md gap-5">
      <Field>
        <FieldLabel>Month first (default)</FieldLabel>
        <NaturalTimeInput defaultValue="dinner on 3/4" {...pinned} />
      </Field>
      <Field>
        <FieldLabel>Day first</FieldLabel>
        <NaturalTimeInput parse={{ dateOrder: 'DMY' }} defaultValue="dinner on 3/4" {...pinned} />
      </Field>
    </div>
  )
}
