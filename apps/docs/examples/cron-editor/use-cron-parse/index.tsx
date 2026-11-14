import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Field, FieldLabel } from '@/components/ui/field'
import { nextCronRuns } from '@/lib/cron'
import { useCronParse } from '@/lib/gpu-cron'

// useCronParse checks for WebGPU first (`supported` is null, then true or
// false), then debounces, drops out-of-order answers and cleans up. The model
// always answers, so show `result.expression` for the person to check.
// `next` from the model is in the device's zone; `nextCronRuns` takes any zone.
export default function UseCronParse() {
  const [text, setText] = useState('every 15 minutes')
  const { result, error, pending, supported } = useCronParse(text)

  if (supported === null) return <p className="m-0 text-footnote text-foreground/70">Checking for WebGPU…</p>
  if (!supported) {
    return (
      <p className="m-0 text-footnote text-foreground/70">
        This browser has no WebGPU, so there is no plain-English box. Type the expression instead.
      </p>
    )
  }
  const next = result
    ? nextCronRuns(result.expression, { from: '2026-10-02T10:00:00Z', count: 2, timeZone: 'UTC' })
    : []
  return (
    <div className="mx-auto grid max-w-md gap-3">
      <Field>
        <FieldLabel className="text-foreground/70">Describe the schedule</FieldLabel>
        <Input value={text} onValueChange={setText} />
      </Field>
      <p className="m-0 min-h-[18px] px-1 text-footnote text-foreground/70" aria-live="polite">
        {error
          ? error.message
          : result
            ? `${pending ? 'Reading… last answer: ' : 'The model read it as '}${result.expression}${next.length ? ` (next: ${next.map((d) => d.toISOString()).join(', ')})` : ''}`
            : ''}
      </p>
    </div>
  )
}
