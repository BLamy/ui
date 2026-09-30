import { useState } from 'react'
import { ComboBox, ComboBoxContent, ComboBoxInput, ComboBoxItem } from '@/components/ui/combobox'
import { Label } from '@/components/ui/label'
import { FieldDescription } from '@/components/ui/text-field'
import { ThemeScope } from '@/lib/theme'

const labels = ['bug', 'design', 'docs', 'performance', 'question', 'security']

// `allowsCustomValue` lets the text stand on its own: Enter keeps whatever was
// typed even when it matches no item.
export default function CustomValue() {
  const [label, setLabel] = useState('')
  const known = labels.includes(label)
  // The ThemeScope is only here so the portalled overlay wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto max-w-sm">
      <ComboBox allowsCustomValue inputValue={label} onInputChange={setLabel}>
        <Label variant="field">Label</Label>
        <ComboBoxInput placeholder="Pick one or type your own" />
        <FieldDescription>
          {label === '' ? 'Nothing typed yet.' : known ? `“${label}” is an existing label.` : `“${label}” will be created as a new label.`}
        </FieldDescription>
        <ComboBoxContent>
          {labels.map((l) => <ComboBoxItem key={l} id={l}>{l}</ComboBoxItem>)}
        </ComboBoxContent>
      </ComboBox>
    </ThemeScope>
  )
}
