import wasmURL from '@agent-wasm/tailscale-connect/main.wasm?url'
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'
import { webStorageTailscalePersistence } from '@/lib/tailscale'
import { createTailscaleConnectClient } from '@/lib/tailscale-connect'
import { TailscaleProvider, useTailscaleStatus } from '@/lib/tailscale-react'

// Sign in with Tailscale for real: the button loads Tailscale's client
// (WebAssembly, about 26 MB, fetched on the first press), which asks the
// control server for a sign-in page and opens it in a popup. Approve it with
// your Tailscale account and this tab joins your tailnet as a device named
// "bl-ui-docs". The device is kept for this tab only (sessionStorage); sign out
// to remove it.
const client = () => createTailscaleConnectClient({ wasmURL })

function Device() {
  const { status, selfName, addresses, peers, tailnet } = useTailscaleStatus()
  if (status !== 'connected') return null
  return (
    <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-footnote">
      <dt className="text-foreground/70">Tailnet</dt>
      <dd className="m-0">{tailnet}</dd>
      <dt className="text-foreground/70">This device</dt>
      <dd className="m-0 font-semibold" data-testid="self-name">{selfName}</dd>
      <dt className="text-foreground/70">Addresses</dt>
      <dd className="m-0 tabular-nums">{addresses.join(', ')}</dd>
      <dt className="text-foreground/70">Peers</dt>
      <dd className="m-0">{peers.length ? peers.map((p) => p.name).join(', ') : 'none online'}</dd>
    </dl>
  )
}

export default function SignIn() {
  return (
    <div className="mx-auto grid w-full max-w-sm gap-4">
      <TailscaleProvider
        options={{ client, hostname: 'bl-ui-docs', persistence: webStorageTailscalePersistence(sessionStorage, 'bl-docs-tailscale'), lockName: 'docs-sign-in' }}
      >
        <TailscaleLoginButton size="pill" />
        <TailscaleStatusBadge />
        <Device />
      </TailscaleProvider>
    </div>
  )
}
