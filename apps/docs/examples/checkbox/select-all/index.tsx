import { useState } from 'react'
import { Checkbox, CheckboxGroup } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const channels = ['Email', 'Push notifications', 'SMS', 'Slack']

// CheckboxGroup owns an array of values. A "select all" box on top is
// indeterminate while only some are chosen, and toggles the whole set.
export default function SelectAll() {
  const [selected, setSelected] = useState<string[]>(['Email', 'Slack'])
  const all = selected.length === channels.length
  return (
    <div className="mx-auto grid max-w-sm gap-4 rounded-card bg-card p-5 shadow-hairline">
      <Checkbox
        isSelected={all}
        isIndeterminate={selected.length > 0 && !all}
        onChange={(on) => setSelected(on ? channels : [])}
      >
        <span className="font-semibold">All channels</span>
      </Checkbox>
      <CheckboxGroup value={selected} onChange={setSelected} className="gap-3 pl-[34px]">
        <Label variant="field" className="sr-only">Notification channels</Label>
        {channels.map((c) => (
          <Checkbox key={c} value={c}>{c}</Checkbox>
        ))}
      </CheckboxGroup>
      <p className="m-0 text-footnote text-muted-foreground">{selected.length} of {channels.length} selected</p>
    </div>
  )
}
