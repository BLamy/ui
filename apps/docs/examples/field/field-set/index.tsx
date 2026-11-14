import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldDescription, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

// A FieldSet is a native <fieldset>: its legend names the group, a
// FieldDescription right inside it describes the group, and `disabled`
// disables every control in it (and leaves them out of the form's values).
export default function Sets() {
  const [same, setSame] = useState(true)
  return (
    <div className="mx-auto grid max-w-sm gap-6">
      <FieldSet>
        <FieldLegend>Shipping address</FieldLegend>
        <FieldGroup>
          <Field name="street">
            <FieldLabel>Street</FieldLabel>
            <Input autoComplete="shipping street-address" defaultValue="1 Infinite Loop" />
          </Field>
          <Field name="city">
            <FieldLabel>City</FieldLabel>
            <Input autoComplete="shipping address-level2" defaultValue="Cupertino" />
          </Field>
        </FieldGroup>
        <FieldDescription>We only ship within the United States.</FieldDescription>
      </FieldSet>
      <Label variant="control">
        <Checkbox checked={same} onCheckedChange={(checked) => setSame(checked === true)} />
        Bill to the shipping address
      </Label>
      <FieldSet disabled={same}>
        <FieldLegend>Billing address</FieldLegend>
        <FieldGroup>
          <Field name="billing-street">
            <FieldLabel>Street</FieldLabel>
            <Input autoComplete="billing street-address" />
          </Field>
          <Field name="billing-city">
            <FieldLabel>City</FieldLabel>
            <Input autoComplete="billing address-level2" />
          </Field>
        </FieldGroup>
      </FieldSet>
    </div>
  )
}
