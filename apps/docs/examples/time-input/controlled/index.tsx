import { useState } from 'react'
import { TimeInput } from '@/components/ui/time-input'

// `onValueChange` fires on every keystroke with `pending: true` (what a
// controlled `value` follows), then once more with the parse when it settles.
// Read `result` only when `pending` is false.
export default function Controlled() {
  const [text, setText] = useState('tomorrow at 3pm')
  const [start, setStart] = useState<string | null>(null)
  return (
    <div className="mx-auto grid max-w-md gap-3">
      <TimeInput
        label="Reminder"
        value={text}
        onValueChange={({ text, result, pending }) => {
          setText(text)
          if (!pending) setStart(result?.occurrences[0]?.start ?? null)
        }}
        reference="2026-09-09T12:00:00+06:00"
        timeZone="Asia/Dhaka"
        locale="en-US"
      />
      <p className="m-0 px-1 text-footnote text-foreground/70">
        First start, as the parser returns it: <code>{start ?? 'nothing yet'}</code>
      </p>
    </div>
  )
}
