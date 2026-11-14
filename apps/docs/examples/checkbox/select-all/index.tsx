import { useState } from 'react'
import { Checkbox, CheckboxGroup } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const channels = ['Email', 'Push notifications', 'SMS', 'Slack']

// CheckboxGroup owns an array of values. The `parent` box on top is checked
// when every value is, mixed (indeterminate) while only some are, and checks
// or clears the whole set. `allValues` gives it the full list up front.
export default function SelectAll() {
  const [selected, setSelected] = useState<string[]>(['Email', 'Slack'])
  return (
    <div className="mx-auto grid max-w-sm gap-4 rounded-card bg-card p-5 shadow-hairline">
      <CheckboxGroup aria-label="Notification channels" value={selected} onValueChange={setSelected} allValues={channels} className="gap-3">
        <Label variant="control">
          <Checkbox parent />
          <span className="font-semibold">All channels</span>
        </Label>
        <div className="grid gap-3 pl-[34px]">
          {channels.map((c) => (
            <Label key={c} variant="control">
              <Checkbox value={c} />
              {c}
            </Label>
          ))}
        </div>
      </CheckboxGroup>
      <p className="m-0 text-footnote text-muted-foreground">{selected.length} of {channels.length} selected</p>
    </div>
  )
}
