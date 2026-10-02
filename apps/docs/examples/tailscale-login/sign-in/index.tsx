import { useState } from 'react'
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'
import { createFakeTailscaleClient } from '@/lib/tailscale-fake'
import { TailscaleProvider, useTailscaleStatus } from '@/lib/tailscale-react'

// A fake tailnet: nothing leaves the page and no account is needed. It hands
// out a login URL like the real control server and approves it after 1.5 s.
// In an app, pass `client: () => createTailscaleConnectClient({ wasmURL })`.
const fake = () =>
  createFakeTailscaleClient({
    tailnet: 'demo-tailnet.ts.net',
    approveAfterMs: 1500,
    routes: { nas: () => new Response('ok'), printer: () => new Response('ok') },
  })

function Device() {
  const { status, selfName, addresses, peers, loginUrl } = useTailscaleStatus()
  return (
    <div className="grid gap-2 text-footnote">
      {status === 'signing-in' && loginUrl ? (
        <p className="m-0 text-foreground/70">
          The popup opens the control server&apos;s sign-in page. This demo has no popup and approves by itself.
        </p>
      ) : null}
      {status === 'connected' ? (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-foreground/70">This device</dt>
          <dd className="m-0 font-semibold" data-testid="self-name">{selfName}</dd>
          <dt className="text-foreground/70">Addresses</dt>
          <dd className="m-0 tabular-nums">{addresses.join(', ')}</dd>
          <dt className="text-foreground/70">Peers</dt>
          <dd className="m-0">{peers.map((p) => p.name).join(', ')}</dd>
        </dl>
      ) : null}
    </div>
  )
}

export default function SignIn() {
  const [client] = useState(fake)
  return (
    <div className="mx-auto grid w-full max-w-sm gap-4">
      {/* popup: false — the fake's login URL goes nowhere. Leave it on in an app. */}
      <TailscaleProvider options={{ client: client.client, popup: false, lockName: 'docs-sign-in' }}>
        <TailscaleLoginButton size="pill" />
        <TailscaleStatusBadge />
        <Device />
      </TailscaleProvider>
    </div>
  )
}
