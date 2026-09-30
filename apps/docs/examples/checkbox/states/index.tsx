import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Form } from '@/components/ui/form'

// `shape` is circle (the iOS selection mark) or square. Disabled dims the row.
// `isRequired` inside a Form blocks submit until it is checked, and marks the
// box invalid (red) once validation has run.
export default function States() {
  const [sent, setSent] = useState(false)
  return (
    <div className="mx-auto grid max-w-sm gap-6">
      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
        <Checkbox defaultSelected>Circle</Checkbox>
        <Checkbox shape="square" defaultSelected>Square</Checkbox>
        <Checkbox isIndeterminate>Indeterminate</Checkbox>
        <Checkbox shape="square" isIndeterminate>Indeterminate</Checkbox>
        <Checkbox isDisabled>Disabled</Checkbox>
        <Checkbox shape="square" isDisabled defaultSelected>Disabled on</Checkbox>
      </div>
      <Form onSubmit={(e) => { e.preventDefault(); setSent(true) }} onReset={() => setSent(false)} className="gap-3">
        <Checkbox shape="square" name="terms" isRequired>I agree to the Terms of Service</Checkbox>
        <div className="flex items-center gap-3">
          <Button type="submit" size="sm">Continue</Button>
          {sent ? <span className="text-footnote text-success">Accepted</span> : <span className="text-footnote text-muted-foreground">Submit without checking the box.</span>}
        </div>
      </Form>
    </div>
  )
}
