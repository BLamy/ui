import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Form } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { Radio, RadioGroup } from '@/components/ui/radio-group'

// A required group in a Field: submitting without a choice turns the radios
// red, shows the FieldError under them and moves focus to the group. The
// field's label names the group.
export default function Validation() {
  const [picked, setPicked] = useState<string | null>(null)
  return (
    <Form
      className="mx-auto max-w-sm"
      onSubmit={(e) => {
        e.preventDefault()
        setPicked(String(new FormData(e.currentTarget).get('region')))
      }}
    >
      <Field>
        <FieldLabel variant="field">Data region</FieldLabel>
        <RadioGroup name="region" required>
          <Label variant="control"><Radio value="us" />United States</Label>
          <Label variant="control"><Radio value="eu" />European Union</Label>
          <Label variant="control"><Radio value="ap" />Asia Pacific</Label>
        </RadioGroup>
        <FieldError match="valueMissing">Choose where your data is stored.</FieldError>
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">Save</Button>
        {picked ? <span className="text-footnote text-success">Saved: {picked}</span> : null}
      </div>
    </Form>
  )
}
