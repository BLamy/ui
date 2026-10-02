import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { passkeyUnsupportedReason, wipe, type Bytes } from '@/lib/passkey'
import { usePasskey } from '@/lib/vault-react'

// The theme's primary and muted text are under AA contrast for body text; these two classes are the vault screens' fix.
const action = 'bg-[color-mix(in_oklab,var(--primary)_78%,black)]'
const muted = 'text-foreground/70'
const SALT = new TextEncoder().encode('bl-ui docs: prf demo v1')

/** A short fingerprint of a secret, so the demo can show "same secret" without printing the secret itself. */
async function fingerprint(secret: Bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', secret))
  return Array.from(digest.slice(0, 4), (b) => b.toString(16).padStart(2, '0')).join('')
}

// The bare passkey layer, no vault: create a passkey with the PRF extension,
// then ask for the secret again. The same credential and salt always give the
// same bytes; they are never stored, so only the fingerprint is shown.
export default function Prf() {
  const passkey = usePasskey()
  const [credentialId, setCredentialId] = useState<string | null>(null)
  const [prints, setPrints] = useState<string[]>([])
  const unavailable = passkey.support ? passkeyUnsupportedReason(passkey.support) : null

  async function create() {
    const created = await passkey.create({ rpName: 'BL UI docs', userName: 'prf-demo', salt: SALT })
    if (!created) return
    setCredentialId(created.credentialId)
    setPrints([])
    if (created.secret) {
      const print = await fingerprint(created.secret)
      wipe(created.secret)
      setPrints([print])
    }
  }

  async function derive() {
    if (!credentialId) return
    const got = await passkey.getSecret([credentialId], SALT)
    if (!got) return
    const print = await fingerprint(got.secret)
    wipe(got.secret)
    setPrints((p) => [...p, print])
  }

  return (
    <div className="mx-auto grid max-w-sm gap-3 rounded-card bg-card p-4 shadow-hairline">
      <div className="flex flex-wrap items-center gap-2 text-subhead">
        <span className="font-semibold">usePasskey</span>
        <Badge variant={passkey.status === 'error' ? 'destructive' : passkey.status === 'success' ? 'success' : 'secondary'}>{passkey.status}</Badge>
        {passkey.support ? <Badge variant="outline">PRF: {passkey.support.prf}</Badge> : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button className={action} isDisabled={unavailable !== null} isPending={passkey.status === 'pending'} onPress={() => void create()}>
          Create passkey
        </Button>
        <Button variant="secondary" isDisabled={!credentialId} onPress={() => void derive()}>
          Derive secret again
        </Button>
      </div>
      {unavailable ? <p role="status" className={`m-0 text-footnote ${muted}`}>Passkeys are unavailable here ({unavailable}).</p> : null}
      {passkey.error ? <p role="alert" className="m-0 text-footnote text-destructive">{passkey.error.reason}: {passkey.error.message}</p> : null}
      {prints.length ? (
        <ol className={`m-0 grid list-none gap-1 p-0 text-footnote ${muted}`}>
          {prints.map((p, i) => (
            <li key={i}>
              Secret #{i + 1} fingerprint <code className="font-mono text-foreground">{p}</code>
              {i > 0 && p === prints[0] ? ' (same as #1)' : ''}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
