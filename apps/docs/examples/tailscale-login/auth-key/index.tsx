import { useState } from 'react'
import wasmURL from '@agent-wasm/tailscale-connect/main.wasm?url'
import { FieldDescription, TextField } from '@/components/ui/text-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'
import { createTailscaleConnectClient } from '@/lib/tailscale-connect'
import { TailscaleProvider } from '@/lib/tailscale-react'

// Sign in without a person: your server mints a short-lived, single-use,
// ephemeral pre-auth key for the user it already knows, and the page passes it
// to the client. The key is never stored. To try it, create an ephemeral auth
// key in your Tailscale admin console (Settings → Keys) and paste it below; in
// an app, `authKey` fetches one from your server:
//
//   authKey: async (signal) => (await (await fetch('/api/tailscale/auth-key', { method: 'POST', credentials: 'include', signal })).json()).authKey
export default function AuthKey() {
  const [key, setKey] = useState('')
  return (
    <div className="mx-auto grid w-full max-w-sm gap-4">
      <TextField type="password" autoComplete="off" value={key} onChange={setKey}>
        <Label variant="field" className="text-foreground/70">Auth key</Label>
        <Input placeholder="tskey-auth-…" />
        <FieldDescription className="text-foreground/70">An ephemeral key from your admin console. Used once, never stored.</FieldDescription>
      </TextField>
      <TailscaleProvider
        options={{ client: () => createTailscaleConnectClient({ wasmURL }), hostname: 'bl-ui-docs-kiosk', auth: { mode: 'auth-key', authKey: async () => key.trim() }, lockName: 'docs-auth-key' }}
      >
        <TailscaleLoginButton variant="outline" labels={{ signIn: 'Connect this kiosk' }} isDisabled={!key.trim().startsWith('tskey-')} />
        <TailscaleStatusBadge />
      </TailscaleProvider>
    </div>
  )
}
