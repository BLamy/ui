import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Radio, RadioGroup } from '@/components/ui/radio-group'

// Arrow keys move the selection inside the group; Tab enters and leaves it as a
// single stop. `orientation="horizontal"` lays the options out in a row; put
// the options in their own row if the group also has a label.
export default function Plans() {
  const [plan, setPlan] = useState('pro')
  return (
    <div className="mx-auto grid max-w-sm gap-6">
      <RadioGroup value={plan} onChange={setPlan}>
        <Label variant="field">Plan</Label>
        <Radio value="free">Free</Radio>
        <Radio value="pro">Pro · $8 / month</Radio>
        <Radio value="team">Team · $20 / seat</Radio>
        <Radio value="enterprise" isDisabled>Enterprise (contact sales)</Radio>
      </RadioGroup>
      <RadioGroup orientation="horizontal" defaultValue="monthly">
        <Label variant="field">Billing</Label>
        <div className="flex gap-5">
          <Radio value="monthly">Monthly</Radio>
          <Radio value="yearly">Yearly</Radio>
        </div>
      </RadioGroup>
      <p className="m-0 px-1 text-footnote text-muted-foreground">Selected plan: {plan}</p>
    </div>
  )
}
