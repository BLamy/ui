import { useState } from 'react'
import { weekday } from '@ui-sdk/core/date'
import { Button } from '@/components/ui/button'
import { DateField } from '@/components/ui/date-field'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'

// Two kinds of error. The first field is checked by the browser: `required`,
// `min` and `max` turn its outline red at once and block the form, and the
// FieldError shows the message after a submit attempt. The second is decided by
// your code: `invalid` on the Field shows its FieldError straight away. The
// bounds are fixed dates (not "today") so the demo reads the same for everyone.
export default function Validation() {
  const [delivery, setDelivery] = useState<string | null>('2026-09-12')
  const saturday = delivery !== null && weekday(delivery) === 6
  return (
    <FieldGroup render={<form onSubmit={(event) => event.preventDefault()} />} className="gap-5 mx-auto max-w-sm">
      <Field name="check-in">
        <FieldLabel>Check-in</FieldLabel>
        <DateField locale="en-US" required min="2026-09-01" max="2026-12-31" defaultValue="2026-08-20" />
        <FieldDescription>Between 1 September and 31 December 2026.</FieldDescription>
        <FieldError />
      </Field>

      <Field name="delivery" invalid={saturday ? true : undefined}>
        <FieldLabel>Delivery</FieldLabel>
        <DateField locale="en-US" value={delivery} onValueChange={setDelivery} />
        <FieldError>We do not deliver on Saturdays.</FieldError>
      </Field>

      <Button type="submit" size="pill">
        Book
      </Button>
    </FieldGroup>
  )
}
