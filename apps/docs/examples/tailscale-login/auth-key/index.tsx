import { useState } from 'react'
import wasmURL from '@agent-wasm/tailscale-connect/main.wasm?url'
import { Segmented } from '@/components/ui/segmented'
import { FieldDescription, TextField } from '@/components/ui/text-field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'
import { createTailscaleConnectClient } from '@/lib/tailscale-connect'
import { createFakeTailscaleClient } from '@/lib/tailscale-fake'
import { TailscaleProvider } from '@/lib/tailscale-react'

// Sign in without a person: your server mints a short-lived, single-use,
// ephemeral pre-auth key for the user it already knows, and the page passes it
// to the client. The key is never stored. To try it for real, create an
// ephemeral auth key in your Tailscale admin console (Settings → Keys) and
// paste it below; in an app, `authKey` fetches one from your server:
//
//   authKey: async (signal) => (await (await fetch('/api/tailscale/auth-key', { method: 'POST', credentials: 'include', signal })).json()).authKey
type Mode = 'real' | 'simulated'

async function simulatedServer(signal: AbortSignal): Promise<string> {
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, 500)
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('cancelled')) })
  })
  return 'demo-not-a-real-key'
}

export default function AuthKey() {
  const [mode, setMode] = useState<Mode>('real')
  const [key, setKey] = useState('')
  const [simulated] = useState(() => createFakeTailscaleClient({ tailnet: 'demo-tailnet.ts.net', acceptKeys: ['demo-not-a-real-key'] }))
  return (
    <div className="mx-auto grid w-full max-w-sm gap-4">
      <Segmented
        aria-label="Tailnet"
        value={mode}
        onChange={(m) => setMode(m as Mode)}
        options={[{ id: 'real', label: 'Your tailnet' }, { id: 'simulated', label: 'Simulated' }]}
      />
      {mode === 'real' ? (
        <TextField type="password" autoComplete="off" value={key} onChange={setKey}>
          <Label variant="field" className="text-foreground/70">Auth key</Label>
          <Input placeholder="tskey-auth-…" />
          <FieldDescription className="text-foreground/70">An ephemeral key from your admin console. Used once, never stored.</FieldDescription>
        </TextField>
      ) : null}
      <TailscaleProvider
        key={mode}
        options={
          mode === 'real'
            ? { client: () => createTailscaleConnectClient({ wasmURL }), hostname: 'bl-ui-docs-kiosk', auth: { mode: 'auth-key', authKey: async () => key.trim() }, lockName: 'docs-auth-key' }
            : { client: simulated.client, auth: { mode: 'auth-key', authKey: simulatedServer }, lockName: 'docs-auth-key-simulated' }
        }
      >
        <TailscaleLoginButton variant="outline" labels={{ signIn: 'Connect this kiosk' }} isDisabled={mode === 'real' && !key.trim().startsWith('tskey-')} />
        <TailscaleStatusBadge />
      </TailscaleProvider>
    </div>
  )
}
