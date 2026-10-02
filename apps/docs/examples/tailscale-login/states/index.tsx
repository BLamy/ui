import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'
import type { TailscaleStatus } from '@/lib/tailscale'

// Every state, driven by props (no provider): what each looks like and says.
const STATES: TailscaleStatus[] = ['idle', 'loading', 'signing-in', 'starting', 'needs-approval', 'connected', 'error']

export default function States() {
  return (
    <div className="mx-auto grid w-full max-w-xl gap-3">
      {STATES.map((status) => (
        <div key={status} className="flex flex-wrap items-center gap-3">
          <TailscaleLoginButton status={status} size="sm" onSignIn={() => {}} onCancel={() => {}} onSignOut={() => {}} />
          <TailscaleStatusBadge
            status={status}
            tailnet="tail1234.ts.net"
            loginUrl={status === 'signing-in' ? 'https://login.tailscale.com/a/example' : null}
            error="The Tailscale client failed to start."
          />
        </div>
      ))}
    </div>
  )
}
