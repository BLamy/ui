import { FieldDescription, FieldError, TextField } from '@/components/ui/text-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const taken = ['brett', 'admin', 'replay']

// `validationBehavior="aria"` validates live as you type; the default
// ("native") waits for the enclosing Form to be submitted. `validate` returns
// a message (or several) for an invalid value, and FieldError renders it.
export default function Validation() {
  return (
    <div className="mx-auto grid max-w-sm gap-5">
      <TextField
        validationBehavior="aria"
        defaultValue="admin"
        validate={(v) => {
          if (v.length < 3) return 'Usernames need at least 3 characters.'
          if (taken.includes(v.toLowerCase())) return `“${v}” is already taken.`
          return null
        }}
      >
        <Label variant="field">Username</Label>
        <Input />
        <FieldDescription>Try “brett”, or something short.</FieldDescription>
        <FieldError />
      </TextField>
      <TextField
        type="email"
        validationBehavior="aria"
        defaultValue="jane@"
        validate={(v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a full address like jane@example.com.')}
      >
        <Label variant="field">Email</Label>
        <Input placeholder="you@example.com" />
        <FieldError />
      </TextField>
    </div>
  )
}
