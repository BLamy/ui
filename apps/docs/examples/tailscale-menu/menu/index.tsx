import wasmURL from '@agent-wasm/tailscale-connect/main.wasm?url'
import { Segmented } from '@/components/ui/segmented'
import { TailscaleLoginButton } from '@/components/ui/tailscale-login-button'
import { TailscaleMenu, type TailscaleMenuProps } from '@/components/ui/tailscale-menu'
import { webStorageTailscalePersistence } from '@/lib/tailscale'
import { createTailscaleConnectClient } from '@/lib/tailscale-connect'
import { TailscaleProvider, useTailscaleStatus } from '@/lib/tailscale-react'
import { useState } from 'react'

// The Tailscale menu on your own tailnet. Sign in (about 26 MB of WebAssembly,
// fetched on the first press; the popup is Tailscale's own page), and the
// menu lists the exit nodes your tailnet offers. Offline devices are marked
// (radio) or dimmed and not selectable (networks). Choosing one routes this
// tab's public traffic through it.
const client = () => createTailscaleConnectClient({ wasmURL })

function Menu() {
  const { status } = useTailscaleStatus()
  const [variant, setVariant] = useState<NonNullable<TailscaleMenuProps['variant']>>('networks')
  if (status !== 'connected') return <TailscaleLoginButton size="pill" />
  return (
    <div className="grid gap-4">
      <Segmented
        aria-label="Menu style"
        value={variant}
        onChange={(v) => setVariant(v as typeof variant)}
        options={[{ id: 'networks', label: 'Networks' }, { id: 'radio', label: 'Radio' }]}
      />
      <TailscaleMenu variant={variant} className="rounded-card bg-card p-3 shadow-hairline" />
    </div>
  )
}

export default function MenuDemo() {
  return (
    <div className="mx-auto grid w-full max-w-xs gap-4">
      <TailscaleProvider
        options={{ client, hostname: 'bl-ui-docs', persistence: webStorageTailscalePersistence(sessionStorage, 'bl-docs-tailscale'), lockName: 'docs-tailscale-menu' }}
      >
        <Menu />
      </TailscaleProvider>
    </div>
  )
}
