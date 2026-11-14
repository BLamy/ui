import { useState } from 'react'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { formatOccurrence, useTimeParse } from '@/lib/gpu-time'

// useTimeParse is the engine under TimeInput: it debounces, drops answers that
// arrive out of order and cleans up on unmount. Here it feeds a one-line
// summary instead of a preview panel.
const zone = 'Asia/Dhaka'

export default function UseTimeParse() {
  const [text, setText] = useState('in 2 hours')
  const { result, error, pending, parsedText } = useTimeParse(text, {
    reference: '2026-09-09T12:00:00+06:00',
    timeZone: zone,
    limit: 1,
  })
  const first = result?.occurrences[0]
  return (
    <div className="mx-auto grid max-w-md gap-3">
      <Field>
        <FieldLabel variant="field" className="text-foreground/70">Remind me</FieldLabel>
        <Input value={text} onValueChange={setText} />
      </Field>
      <p className="m-0 min-h-[18px] px-1 text-footnote text-foreground/70" aria-live="polite">
        {error
          ? error.message
          : pending && parsedText !== text
            ? 'Reading…'
            : first
              ? `Reminder set for ${formatOccurrence(first, { timeZone: zone, locale: 'en-US' })}`
              : text.trim()
                ? 'No date or time found.'
                : ''}
      </p>
    </div>
  )
}
