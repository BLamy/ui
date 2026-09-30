import { useState } from 'react'
import { FieldDescription, TextField } from '@/components/ui/text-field'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

const LIMIT = 140

// A TextField around the Textarea gives it a label and a description, and the
// character count is ordinary state. Past the limit the field is marked
// invalid (isInvalid), which turns the ring red.
export default function Counter() {
  const [bio, setBio] = useState('Design engineer. Building a kit of iOS-flavored React parts.')
  const over = bio.length > LIMIT
  return (
    <div className="mx-auto max-w-sm">
      <TextField value={bio} onChange={setBio} isInvalid={over}>
        <Label variant="field">Bio</Label>
        <Textarea size="sm" placeholder="Tell people what you work on" />
        <div className="flex justify-between gap-3">
          <FieldDescription>Shown on your public profile.</FieldDescription>
          <span className={cn('px-1 text-footnote tabular-nums', over ? 'text-destructive' : 'text-muted-foreground')}>
            {bio.length}/{LIMIT}
          </span>
        </div>
      </TextField>
    </div>
  )
}
