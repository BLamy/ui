import { useState } from 'react'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

// Type a name and press Enter, or leave the field: it's only taken then. Escape puts it back. A name with a space or a
// lowercase letter is refused, and the field says why.
export default function Commit() {
  const [name, setName] = useState('UPLOADS')
  const [refused, setRefused] = useState<string | null>(null)
  const [log, setLog] = useState<string[]>([])
  return (
    <div className="flex w-full max-w-xs flex-col gap-3">
      <Field invalid={!!refused}>
        <FieldLabel>On env, as</FieldLabel>
        <Input
          size="sm"
          value={name}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          onValueCommit={(next, details) => {
            setLog((l) => [...l.slice(-2), `${details.reason}: ${next}`])
            if (!/^[A-Z_][A-Z0-9_]*$/.test(next)) return setRefused(`“${next}” can’t be a name on env.`)
            setRefused(null)
            setName(next)
          }}
        />
        <FieldDescription>Capitals, digits and _.</FieldDescription>
        <FieldError>{refused}</FieldError>
      </Field>
      <p className="m-0 text-footnote text-muted-foreground" data-demo-commits={log.join(' | ')}>
        env.{name}
      </p>
    </div>
  )
}
