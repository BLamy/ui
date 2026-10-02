import { useState } from 'react'
import wasmURL from '@agent-wasm/tailscale-connect/main.wasm?url'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'
import { webStorageTailscalePersistence } from '@/lib/tailscale'
import { createTailscaleConnectClient } from '@/lib/tailscale-connect'
import { createFakeTailscaleClient } from '@/lib/tailscale-fake'
import { TailscaleProvider } from '@/lib/tailscale-react'
import { useTailscaleRouter } from '@/lib/tailscale-router/react'

// A real service worker (tailscale-sw.js) in front of your tailnet. Sign in,
// then send plain fetch() calls: the worker hands the ones for *.ts.net and
// Tailscale addresses (100.64.0.0/10) to this page, which answers them through
// Tailscale's client. Signed out, they go to the normal network, where these
// names do not exist. On an https page, ask for https:// tailnet URLs (enable
// HTTPS certificates in your tailnet): the browser blocks http:// requests from
// an https page before any service worker sees them. "Simulated" puts a fake
// tailnet behind the same worker.
type Mode = 'real' | 'simulated'

const demoTailnet = () =>
  createFakeTailscaleClient({
    tailnet: 'demo-tailnet.ts.net',
    approveAfterMs: 800,
    routes: {
      'notes.demo-tailnet.ts.net': async (req) => {
        const path = new URL(req.url).pathname
        if (path === '/echo') return new Response(await req.arrayBuffer(), { headers: { 'content-type': req.headers.get('content-type') ?? 'application/octet-stream' } })
        if (path === '/stream') {
          let n = 0
          return new Response(new ReadableStream<Uint8Array>({
            async pull(c) {
              await new Promise((r) => setTimeout(r, 250))
              if (n++ < 4) c.enqueue(new TextEncoder().encode(`part ${n}\n`))
              else c.close()
            },
          }), { headers: { 'content-type': 'text/plain' } })
        }
        return Response.json({ notes: ['Buy milk', 'Renew the TLS cert'], served: 'by the fake tailnet' })
      },
      '100.101.102.103': () => new Response('pong from 100.101.102.103', { headers: { 'content-type': 'text/plain' } }),
    },
  })

interface Result { status: string; via: string; body: string }

function Console({ mode }: { mode: Mode }) {
  const router = useTailscaleRouter()
  const [url, setUrl] = useState(mode === 'simulated' ? 'http://notes.demo-tailnet.ts.net/' : '')
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
      setResult({ status: 'failed', via: 'network', body: e instanceof Error ? e.message : String(e) })
    }
  }

  return (
    <div className="grid gap-3">
      <p className="m-0 text-footnote text-foreground/70" data-testid="router-status" data-status={router.status}>
        Service worker: {router.status}{router.detail ? ` (${router.detail})` : ''} · {router.routed} routed
      </p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(url) }}>
        <Input aria-label="URL" placeholder="https://your-machine.your-tailnet.ts.net/" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button type="submit" variant="secondary">Fetch</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        {mode === 'simulated' ? (
          <>
            <Button size="sm" variant="secondary" onPress={() => void send('http://notes.demo-tailnet.ts.net/echo', { method: 'POST', body: 'hello over the tailnet' })}>POST echo</Button>
            <Button size="sm" variant="secondary" onPress={() => void send('http://notes.demo-tailnet.ts.net/stream')}>Stream</Button>
            <Button size="sm" variant="secondary" onPress={() => void send('http://100.101.102.103/ping')}>100.101.102.103</Button>
          </>
        ) : null}
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
  const [mode, setMode] = useState<Mode>('real')
  const [fake] = useState(demoTailnet)
  return (
    <div className="mx-auto grid w-full max-w-lg gap-3">
      <Segmented
        aria-label="Tailnet"
        value={mode}
        onChange={(m) => setMode(m as Mode)}
        options={[{ id: 'real', label: 'Your tailnet' }, { id: 'simulated', label: 'Simulated' }]}
      />
      <TailscaleProvider
        key={mode}
        options={
          mode === 'real'
            ? { client: () => createTailscaleConnectClient({ wasmURL }), hostname: 'bl-ui-docs-router', persistence: webStorageTailscalePersistence(sessionStorage, 'bl-docs-tailscale-router'), lockName: 'docs-router' }
            : { client: fake.client, popup: false, lockName: 'docs-router-simulated' }
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <TailscaleLoginButton />
          <TailscaleStatusBadge compact />
        </div>
        <Console mode={mode} />
      </TailscaleProvider>
    </div>
  )
}
