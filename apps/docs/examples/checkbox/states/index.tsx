import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { FieldGroup } from '@/components/ui/field'

// `shape` is circle (the iOS selection mark) or square. Each box sits in a
// `control` Label with its text, so the whole line presses it and dims with it.
// `required` inside a form blocks submit until it is checked.
export default function States() {
  const [sent, setSent] = useState(false)
  return (
    <div className="mx-auto grid max-w-sm gap-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Label variant="control"><Checkbox defaultChecked />Circle</Label>
        <Label variant="control"><Checkbox shape="square" defaultChecked />Square</Label>
        <Label variant="control"><Checkbox defaultChecked="indeterminate" />Indeterminate</Label>
        <Label variant="control"><Checkbox shape="square" defaultChecked="indeterminate" />Indeterminate</Label>
        <Label variant="control"><Checkbox disabled />Disabled</Label>
        <Label variant="control"><Checkbox shape="square" disabled defaultChecked />Disabled on</Label>
      </div>
      <FieldGroup render={<form onSubmit={(e) => { e.preventDefault(); setSent(true) }} onReset={() => setSent(false)} />} className="gap-3">
        <Label variant="control"><Checkbox shape="square" name="terms" required />I agree to the Terms of Service</Label>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm">Continue</Button>
          {sent ? <span className="text-footnote text-success">Accepted</span> : <span className="text-footnote text-muted-foreground">Submit without checking the box.</span>}
        </div>
      </FieldGroup>
    </div>
  )
}
