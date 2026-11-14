import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Radio, RadioGroup } from '@/components/ui/radio-group'

// Arrow keys move the selection inside the group; Tab enters and leaves it as a
// single stop. Each Radio is the circle: wrap it and its text in a `control`
// Label. A Label whose `htmlFor` is the group's `id` names the group.
// `orientation="horizontal"` lays the options out in a row.
export default function Plans() {
  const [plan, setPlan] = useState('pro')
  return (
    <div className="mx-auto grid max-w-sm gap-6">
      <div className="grid gap-3">
        <Label variant="field" htmlFor="plan">Plan</Label>
        <RadioGroup id="plan" value={plan} onValueChange={(v) => v && setPlan(v)}>
          <Label variant="control"><Radio value="free" />Free</Label>
          <Label variant="control"><Radio value="pro" />Pro · $8 / month</Label>
          <Label variant="control"><Radio value="team" />Team · $20 / seat</Label>
          <Label variant="control"><Radio value="enterprise" disabled />Enterprise (contact sales)</Label>
        </RadioGroup>
      </div>
      <div className="grid gap-3">
        <Label variant="field" htmlFor="billing">Billing</Label>
        <RadioGroup id="billing" orientation="horizontal" defaultValue="monthly">
          <Label variant="control"><Radio value="monthly" />Monthly</Label>
          <Label variant="control"><Radio value="yearly" />Yearly</Label>
        </RadioGroup>
      </div>
      <p className="m-0 px-1 text-footnote text-muted-foreground">Selected plan: {plan}</p>
    </div>
  )
}
