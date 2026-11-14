import { useState } from 'react'
import { Combobox, ComboboxContent, ComboboxInput } from '@/components/ui/combobox'
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field'
import { ThemeScope } from '@/lib/theme'

const labels = ['bug', 'design', 'docs', 'performance', 'question', 'security']

// `allowCustomValue` lets the text stand on its own: Enter keeps whatever was
// typed as the value, even when it matches no option.
export default function CustomValue() {
  const [label, setLabel] = useState<string | null>(null)
  const known = label !== null && labels.includes(label)
  // The ThemeScope is only here so the overlay wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto max-w-sm">
      <Field>
        <FieldLabel variant="field">Label</FieldLabel>
        <Combobox items={labels} allowCustomValue value={label} onValueChange={setLabel}>
          <ComboboxInput placeholder="Pick one or type your own" />
          <ComboboxContent />
        </Combobox>
        <FieldDescription>
          {label === null || label === '' ? 'Nothing chosen yet.' : known ? `“${label}” is an existing label.` : `“${label}” will be created as a new label.`}
        </FieldDescription>
      </Field>
    </ThemeScope>
  )
}
