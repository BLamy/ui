import { useState } from 'react'
import { DatePicker, DatePickerContent, DatePickerField } from '@/components/ui/date-picker'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { ThemeScope } from '@/lib/theme'

// Pinned to September 2026 in en-US. `mode="range"` holds a `[start, end]` pair
// and gives the field an input for each end; `months={2}` shows two months side
// by side in the popup, which stays open after the start is picked and closes
// once the end is.
export default function Range() {
  const [stay, setStay] = useState<[string, string] | null>(['2026-09-08', '2026-09-13'])
  // The ThemeScope is only here so the popup wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm gap-5">
      <Field>
        <FieldLabel>Stay</FieldLabel>
        <DatePicker
          mode="range"
          months={2}
          pageBy="page"
          locale="en-US"
          value={stay}
          onValueChange={setStay}
        >
          <DatePickerField />
          <DatePickerContent />
        </DatePicker>
        <FieldDescription>
          {stay ? `${stay[0]} to ${stay[1]}` : 'Check-in to check-out.'}
        </FieldDescription>
      </Field>
    </ThemeScope>
  )
}
