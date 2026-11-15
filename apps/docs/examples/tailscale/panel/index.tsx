import wasmURL from '@agent-wasm/tailscale-connect/main.wasm?url'
import { TailscaleExitNodes, TailscaleLoginButton, TailscaleSummary } from '@/components/ui/tailscale-controls'
import { webStorageTailscalePersistence } from '@/lib/tailscale'
import { createTailscaleConnectClient } from '@/lib/tailscale-connect'
import { TailscaleProvider, useTailscaleStatus } from '@/lib/tailscale-react'

// The connection panel on your own tailnet, composed from the parts. Sign in
// (about 26 MB of WebAssembly, fetched on the first press; the popup is
// Tailscale's own page), and the panel lists the exit nodes your tailnet
// offers, offline devices dimmed and not selectable. Choosing one routes this
// tab's public traffic through it.
const client = () => createTailscaleConnectClient({ wasmURL })

function Panel() {
  const { status } = useTailscaleStatus()
  if (status !== 'connected') return <TailscaleLoginButton size="pill" />
  return (
    <div className="flex flex-col gap-3 rounded-card bg-card p-3 shadow-hairline">
      <TailscaleSummary />
      <TailscaleExitNodes />
      <TailscaleLoginButton size="sm" variant="outline" />
    </div>
  )
}

export default function PanelDemo() {
  return (
    <div className="mx-auto grid w-full max-w-xs gap-4">
      <TailscaleProvider
        options={{ client, hostname: 'bl-ui-docs', persistence: webStorageTailscalePersistence(sessionStorage, 'bl-docs-tailscale'), lockName: 'docs-tailscale-panel' }}
      >
        <Panel />
      </TailscaleProvider>
    </div>
  )
}
