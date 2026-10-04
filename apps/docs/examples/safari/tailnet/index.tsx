import { useState } from 'react'
import { Segmented } from '@/components/ui/segmented'
import Safari from '@/components/blocks/safari/page'
import { createDemoTailnet } from '@/components/blocks/safari/data'

// Safari on your real tailnet: press "Sign in with Tailscale" and Tailscale's own sign-in opens in a popup. The client
// (Tailscale's Go code as WebAssembly, about 26 MB) loads on that press and not before. The device lives for this tab.
// A tailnet alone reaches your devices; choose an exit node in the shield menu to open public sites through it.
//
// "Simulated" is an in-memory tailnet with a few demo sites, an exit node and a pretend internet, for trying the browser
// without an account. It is never what <Safari /> does by default.
type Mode = 'real' | 'simulated'

export default function SafariTailnet() {
  const [mode, setMode] = useState<Mode>('real')
  const [demo] = useState(createDemoTailnet)
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-3">
      <div className="max-w-xs">
        <Segmented
          aria-label="Tailnet"
          value={mode}
          onChange={(m) => setMode(m as Mode)}
          options={[{ id: 'real', label: 'Your tailnet' }, { id: 'simulated', label: 'Simulated' }]}
        />
      </div>
      <div className="relative h-[720px] overflow-hidden rounded-card shadow-hairline">
        {/* A new controller per mode: `key` starts over. */}
        <Safari key={mode} tailscale={mode === 'simulated' ? demo.options : undefined} />
      </div>
    </div>
  )
}
