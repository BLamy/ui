import { useState } from 'react'
import wasmURL from '@agent-wasm/tailscale-connect/main.wasm?url'
import { Segmented } from '@/components/ui/segmented'
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'
import { webStorageTailscalePersistence } from '@/lib/tailscale'
import { createTailscaleConnectClient } from '@/lib/tailscale-connect'
import { createFakeTailscaleClient } from '@/lib/tailscale-fake'
import { TailscaleProvider, useTailscaleStatus } from '@/lib/tailscale-react'

// Sign in with Tailscale for real: the button loads Tailscale's client
// (WebAssembly, about 26 MB, fetched on the first press), which asks the
// control server for a sign-in page and opens it in a popup. Approve it with
// your Tailscale account and this tab joins your tailnet as a device named
// "bl-ui-docs". The device is kept for this tab only (sessionStorage); sign out
// to remove it. "Simulated" swaps in a fake tailnet that needs no account.
type Mode = 'real' | 'simulated'

const realClient = () => createTailscaleConnectClient({ wasmURL })
const simulatedClient = () =>
  createFakeTailscaleClient({
    tailnet: 'demo-tailnet.ts.net',
    approveAfterMs: 1500,
    routes: { nas: () => new Response('ok'), printer: () => new Response('ok') },
  }).client

function Device({ mode }: { mode: Mode }) {
  const { status, selfName, addresses, peers, loginUrl, tailnet } = useTailscaleStatus()
  return (
    <div className="grid gap-2 text-footnote">
      {status === 'signing-in' && loginUrl && mode === 'simulated' ? (
        <p className="m-0 text-foreground/70">The simulated tailnet approves by itself.</p>
      ) : null}
      {status === 'connected' ? (
        <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
          <dt className="text-foreground/70">Tailnet</dt>
          <dd className="m-0">{tailnet}</dd>
          <dt className="text-foreground/70">This device</dt>
          <dd className="m-0 font-semibold" data-testid="self-name">{selfName}</dd>
          <dt className="text-foreground/70">Addresses</dt>
          <dd className="m-0 tabular-nums">{addresses.join(', ')}</dd>
          <dt className="text-foreground/70">Peers</dt>
          <dd className="m-0">{peers.length ? peers.map((p) => p.name).join(', ') : 'none online'}</dd>
        </dl>
      ) : null}
    </div>
  )
}

export default function SignIn() {
  const [mode, setMode] = useState<Mode>('real')
  return (
    <div className="mx-auto grid w-full max-w-sm gap-4">
      <Segmented
        aria-label="Tailnet"
        value={mode}
        onChange={(m) => setMode(m as Mode)}
        options={[{ id: 'real', label: 'Your tailnet' }, { id: 'simulated', label: 'Simulated' }]}
      />
      {/* A new controller per mode: switching tears the old client down. */}
      <TailscaleProvider
        key={mode}
        options={
          mode === 'real'
            ? { client: realClient, hostname: 'bl-ui-docs', persistence: webStorageTailscalePersistence(sessionStorage, 'bl-docs-tailscale'), lockName: 'docs-sign-in' }
            : { client: simulatedClient, popup: false, lockName: 'docs-sign-in-simulated' }
        }
      >
        <TailscaleLoginButton size="pill" />
        <TailscaleStatusBadge />
        <Device mode={mode} />
      </TailscaleProvider>
    </div>
  )
}
