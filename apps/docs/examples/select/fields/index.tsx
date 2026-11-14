import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectGroupLabel,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import { ThemeScope } from '@/lib/theme'

const repeats = [
  { value: 'never', label: 'Never' },
  { value: 'day', label: 'Every day' },
  { value: 'week', label: 'Every week' },
  { value: 'month', label: 'Every month' },
]

// Controlled from data, groups in the list, a required field that shows its
// error, and a disabled field. `onValueChange` receives the option's `value`.
export default function Fields() {
  const [repeat, setRepeat] = useState<string | null>('week')
  const [zone, setZone] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  // The ThemeScope is only here so the overlay wears this demo's light / dark
  // appearance; in an app, BLProvider or your root class does it.
  return (
    <ThemeScope className="mx-auto grid max-w-sm gap-5">
      <Field>
        <FieldLabel>Repeat</FieldLabel>
        <Select items={repeats} value={repeat} onValueChange={setRepeat} placeholder="Choose…">
          <SelectTrigger />
          <SelectContent />
        </Select>
        <FieldDescription>Selected value: {repeat ?? 'none'}</FieldDescription>
      </Field>

      <Field invalid={submitted && !zone ? true : undefined}>
        <FieldLabel>Time zone</FieldLabel>
        <Select value={zone} onValueChange={setZone} required placeholder="Choose a time zone">
          <SelectTrigger />
          <SelectContent>
            <SelectGroup>
              <SelectGroupLabel>Americas</SelectGroupLabel>
              <SelectItem value="pt">Pacific Time</SelectItem>
              <SelectItem value="et">Eastern Time</SelectItem>
            </SelectGroup>
            <SelectGroup>
              <SelectGroupLabel>Europe</SelectGroupLabel>
              <SelectItem value="gmt">Greenwich Mean Time</SelectItem>
              <SelectItem value="cet">Central European Time</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldError>Pick a time zone to continue.</FieldError>
      </Field>
      <Button
        variant="secondary"
        size="sm"
        className="justify-self-start"
        onClick={() => setSubmitted(true)}
      >
        Validate
      </Button>

      <Field disabled>
        <FieldLabel>Locked by an admin</FieldLabel>
        <Select items={repeats} defaultValue="never">
          <SelectTrigger size="sm" />
          <SelectContent />
        </Select>
      </Field>
    </ThemeScope>
  )
}
