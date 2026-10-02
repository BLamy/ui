import { useState } from 'react'
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'
import { createFakeTailscaleClient } from '@/lib/tailscale-fake'
import { TailscaleProvider } from '@/lib/tailscale-react'

// Sign in without a person: your server mints a short-lived, single-use,
// ephemeral pre-auth key for the user it already knows, and the page passes it
// to the client. The key is never stored. Here the "server" is a timeout and
// the tailnet is fake; a real endpoint would check the user's own session first.
async function fetchAuthKey(signal: AbortSignal): Promise<string> {
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, 500)
    signal.addEventListener('abort', () => { clearTimeout(t); reject(new Error('cancelled')) })
  })
  return 'demo-not-a-real-key'
  // const res = await fetch('/api/tailscale/auth-key', { method: 'POST', credentials: 'include', signal })
  // return (await res.json()).authKey
}

export default function AuthKey() {
  const [fake] = useState(() => createFakeTailscaleClient({ tailnet: 'demo-tailnet.ts.net', acceptKeys: ['demo-not-a-real-key'] }))
  return (
    <div className="mx-auto grid w-full max-w-sm gap-4">
      <TailscaleProvider options={{ client: fake.client, auth: { mode: 'auth-key', authKey: fetchAuthKey }, lockName: 'docs-auth-key' }}>
        <TailscaleLoginButton variant="outline" labels={{ signIn: 'Connect this kiosk' }} />
        <TailscaleStatusBadge />
      </TailscaleProvider>
    </div>
  )
}
