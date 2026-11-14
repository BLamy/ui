import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

const taken = ['brett', 'admin', 'replay']

function problemWith(username: string) {
  if (username.length < 3) return 'Usernames need at least 3 characters.'
  if (taken.includes(username.toLowerCase())) return `“${username}” is already taken.`
  return ''
}

// Two ways to be invalid. The username is checked by your code as you type:
// pass `invalid` and the message. The email uses the browser's constraints
// (`required`, `type="email"`), which show after a submit attempt and then
// update as you type; each FieldError names the problem it is for.
export default function Validation() {
  const [username, setUsername] = useState('admin')
  const [sent, setSent] = useState(false)
  const problem = problemWith(username)
  return (
    <FieldGroup render={<form onSubmit={(e) => { e.preventDefault(); setSent(true) }} onInput={() => setSent(false)} />} className="gap-5 mx-auto max-w-sm">
      <Field name="username" invalid={problem ? true : undefined}>
        <FieldLabel>Username</FieldLabel>
        <Input value={username} onValueChange={setUsername} />
        <FieldDescription>Try “brett”, or something short.</FieldDescription>
        <FieldError>{problem}</FieldError>
      </Field>
      <Field name="email">
        <FieldLabel>Email</FieldLabel>
        <Input type="email" required placeholder="you@example.com" />
        <FieldError match="valueMissing">Enter your email address.</FieldError>
        <FieldError match="typeMismatch">Enter a full address like jane@example.com.</FieldError>
      </Field>
      <Button type="submit" disabled={!!problem}>Subscribe</Button>
      {sent ? <p className="m-0 px-1 text-footnote text-success">Subscribed.</p> : null}
    </FieldGroup>
  )
}
