import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/text-field'
import { Form } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { Radio, RadioGroup } from '@/components/ui/radio-group'

// A required group is invalid until one is picked; the radios turn red and
// FieldError shows the browser's message after a submit.
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
      <RadioGroup name="region" isRequired>
        <Label variant="field">Data region</Label>
        <Radio value="us">United States</Radio>
        <Radio value="eu">European Union</Radio>
        <Radio value="ap">Asia Pacific</Radio>
        <FieldError>Choose where your data is stored.</FieldError>
      </RadioGroup>
      <div className="flex items-center gap-3">
        <Button type="submit" size="sm">Save</Button>
        {picked ? <span className="text-footnote text-success">Saved: {picked}</span> : null}
      </div>
    </Form>
  )
}
