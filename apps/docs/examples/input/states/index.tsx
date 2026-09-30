import { useState } from 'react'
import { Input } from '@/components/ui/input'

// Focus fills the field with a primary ring; `aria-invalid` turns it red
// (react-aria reads it as data-invalid); `disabled` dims it. Inside a
// TextField the invalid state comes from validation instead — see TextField.
export default function States() {
  const [handle, setHandle] = useState('br')
  const invalid = handle.length < 3
  return (
    <div className="mx-auto grid max-w-sm gap-3">
      <Input aria-label="Email" type="email" placeholder="you@example.com" />
      <Input aria-label="Handle" value={handle} onChange={(e) => setHandle(e.target.value)} aria-invalid={invalid || undefined} placeholder="Handle (3+ characters)" />
      <Input aria-label="Plan" defaultValue="Pro · billed yearly" disabled />
      <Input aria-label="Invite code" defaultValue="RPLY-2041-XK" readOnly />
    </div>
  )
}
