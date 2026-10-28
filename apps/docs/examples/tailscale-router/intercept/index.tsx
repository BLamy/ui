import { useEffect, useState } from 'react'
import wasmURL from '@agent-wasm/tailscale-connect/main.wasm?url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'
import { webStorageTailscalePersistence } from '@/lib/tailscale'
import { createTailscaleConnectClient } from '@/lib/tailscale-connect'
import { exitNodeName, exitNodePeers, pickExitNode } from '@/lib/tailscale-exit'
import { TailscaleProvider, useTailscale, useTailscaleStatus } from '@/lib/tailscale-react'
import { useTailscaleRouter } from '@/lib/tailscale-router/react'

// A real service worker (tailscale-sw.js) in front of your tailnet, routing
// every cross-origin request (`intercept: 'all'`). Sign in, then send plain
// fetch() calls: the worker hands them to this page, which answers them
// through Tailscale's client. Your devices (*.ts.net, 100.x) are reached
// directly; public sites go through an exit node, picked for you once you are
// connected. Signed out, requests go to the normal network. The DNS-over-HTTPS
// server the client looks public names up with is excluded, or each lookup
// would be routed back into the client. On an https page, ask for https://
// URLs: the browser blocks http:// requests before any service worker sees them.

interface Result { status: string; via: string; body: string }

/** Picks an online exit node once connected (public sites need one), and says which. */
function ExitNode() {
  const tailscale = useTailscale()
  const snapshot = useTailscaleStatus()
  const connected = snapshot.status === 'connected'
  const id = connected && !snapshot.exitNodeId ? pickExitNode(snapshot) : null
  useEffect(() => { if (id) void tailscale.setExitNode(id).catch(() => {}) }, [id, tailscale])
  if (!connected) return null
  const current = snapshot.peers.find((p) => p.id === snapshot.exitNodeId)
  return (
    <p className="m-0 text-footnote text-foreground/70" data-testid="exit-node">
      {current ? `Exit node: ${exitNodeName(current)}${current.online ? '' : ' (offline)'}`
        : exitNodePeers(snapshot).length ? 'No exit node online: only your devices can be reached.'
        : 'Your tailnet has no exit node: only your devices can be reached.'}
    </p>
  )
}

function Console() {
  // Leaving the demo removes the worker, so it does not route the rest of this site's requests.
  const router = useTailscaleRouter({ policy: { intercept: 'all', exclude: ['cloudflare-dns.com'] }, unregisterOnDispose: true })
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<Result | null>(null)

  const send = async (target: string, init?: RequestInit) => {
    setResult({ status: '…', via: '', body: '' })
    try {
      const res = await fetch(target, init)
      const via = res.headers.get('x-bl-tailscale') ?? 'network'
      setResult({ status: `${res.status}`, via, body: '' })
      // Read as it arrives, so a streamed body shows up part by part.
      const reader = res.body?.getReader()
      let body = ''
      for (;;) {
        if (!reader) break
        const { done, value } = await reader.read()
        if (done) break
        body += new TextDecoder().decode(value)
        setResult({ status: `${res.status}`, via, body })
      }
    } catch (e) {
      setResult({ status: 'failed', via: 'no response', body: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="grid gap-3">
      <p className="m-0 text-footnote text-foreground/70" data-testid="router-status" data-status={router.status}>
        Service worker: {router.status}{router.detail ? ` (${router.detail})` : ''} · {router.routed} routed
      </p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(url) }}>
        <Input aria-label="URL" placeholder="https://example.com/ or https://your-machine.your-tailnet.ts.net/" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button type="submit" variant="secondary">Fetch</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onPress={() => void send(new URL(`${import.meta.env.BASE_URL}favicon.ico`, location.origin).href)}>Same origin</Button>
        <Button size="sm" variant="ghost" onPress={() => void router.router?.unregister()}>Remove service worker</Button>
      </div>
      <output aria-live="polite" className="grid gap-1 rounded-ctl bg-secondary px-3 py-2 text-footnote">
        {result ? (
          <>
            <span><strong data-testid="result-status">{result.status}</strong> · via <strong data-testid="result-via">{result.via}</strong></span>
            <pre data-testid="result-body" className="m-0 font-mono text-caption whitespace-pre-wrap break-all">{result.body}</pre>
          </>
        ) : <span className="text-foreground/70">Nothing sent yet.</span>}
      </output>
    </div>
  )
}

export default function Intercept() {
  return (
    <div className="mx-auto grid w-full max-w-lg gap-3">
      <TailscaleProvider
        options={{ client: () => createTailscaleConnectClient({ wasmURL }), hostname: 'bl-ui-docs-router', persistence: webStorageTailscalePersistence(sessionStorage, 'bl-docs-tailscale-router'), lockName: 'docs-router' }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <TailscaleLoginButton />
          <TailscaleStatusBadge compact />
        </div>
        <ExitNode />
        <Console />
      </TailscaleProvider>
    </div>
  )
}
