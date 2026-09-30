import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSection,
  SelectTrigger,
} from '@/components/ui/select'
import { FieldDescription, FieldError } from '@/components/ui/text-field'
import { ThemeScope } from '@/lib/theme'

const repeats = [
  { id: 'never', name: 'Never' },
  { id: 'day', name: 'Every day' },
  { id: 'week', name: 'Every week' },
  { id: 'month', name: 'Every month' },
]

// Controlled with a string key, sections in the list, a required field that
// shows its error, and a disabled field. `onChange` receives the item's `id`.
export default function Fields() {
  const [repeat, setRepeat] = useState<string | null>('week')
  const [zone, setZone] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  // The ThemeScope is only here so the portalled overlay wears this demo's
  // light / dark appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm gap-5">
      <Select
        value={repeat}
        onChange={(key) => setRepeat(key as string | null)}
        placeholder="Choose…"
      >
        <Label variant="field">Repeat</Label>
        <SelectTrigger />
        <SelectContent items={repeats}>
          {(item) => <SelectItem>{item.name}</SelectItem>}
        </SelectContent>
        <FieldDescription>Selected key: {repeat ?? 'none'}</FieldDescription>
      </Select>

      <Select
        value={zone}
        onChange={(key) => setZone(key as string | null)}
        isRequired
        isInvalid={submitted && !zone}
        placeholder="Choose a time zone"
      >
        <Label variant="field">Time zone</Label>
        <SelectTrigger />
        <SelectContent>
          <SelectSection title="Americas">
            <SelectItem id="pt">Pacific Time</SelectItem>
            <SelectItem id="et">Eastern Time</SelectItem>
          </SelectSection>
          <SelectSection title="Europe">
            <SelectItem id="gmt">Greenwich Mean Time</SelectItem>
            <SelectItem id="cet">Central European Time</SelectItem>
          </SelectSection>
        </SelectContent>
        <FieldError>Pick a time zone to continue.</FieldError>
      </Select>
      <Button
        variant="secondary"
        size="sm"
        className="justify-self-start"
        onPress={() => setSubmitted(true)}
      >
        Validate
      </Button>

      <Select isDisabled defaultValue="never">
        <Label variant="field">Locked by an admin</Label>
        <SelectTrigger size="sm" />
        <SelectContent items={repeats}>
          {(item) => <SelectItem>{item.name}</SelectItem>}
        </SelectContent>
      </Select>
    </ThemeScope>
  )
}
