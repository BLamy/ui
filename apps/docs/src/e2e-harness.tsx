import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import Safari from '@/components/blocks/safari/page'
import { createDemoTailnet } from '@/components/blocks/safari/data'
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'
import { createFakeTailscaleClient } from '@/lib/tailscale-fake'
import { TailscaleProvider, useTailscaleStatus } from '@/lib/tailscale-react'
import { useTailscaleRouter } from '@/lib/tailscale-router/react'

/* Test tooling, not a demo: `?harness=<name>` (dev server only; main.tsx never loads this in a production build)
   renders the Tailscale components on an in-memory tailnet, so tools/e2e can drive them without a Tailscale account.
   The docs demos themselves run on the real tailnet and have no fake mode. */

function Device() {
  const { status, selfName, tailnet } = useTailscaleStatus()
  return status === 'connected' ? <p data-testid="self-name" data-tailnet={tailnet}>{selfName}</p> : null
}

function SignIn() {
  const [fake] = useState(() => createFakeTailscaleClient({ tailnet: 'demo-tailnet.ts.net', approveAfterMs: 1500 }))
  return (
    <TailscaleProvider options={{ client: fake.client, popup: false, lockName: 'harness-sign-in' }}>
      <TailscaleLoginButton size="pill" />
      <TailscaleStatusBadge />
      <Device />
    </TailscaleProvider>
  )
}

function AuthKey() {
  const [fake] = useState(() => createFakeTailscaleClient({ tailnet: 'demo-tailnet.ts.net', acceptKeys: ['demo-not-a-real-key'] }))
  return (
    <TailscaleProvider options={{ client: fake.client, auth: { mode: 'auth-key', authKey: async () => 'demo-not-a-real-key' }, lockName: 'harness-auth-key' }}>
      <TailscaleLoginButton variant="outline" labels={{ signIn: 'Connect this kiosk' }} />
      <TailscaleStatusBadge />
    </TailscaleProvider>
  )
}

const routerTailnet = () =>
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

function Console() {
  const router = useTailscaleRouter()
  const [url, setUrl] = useState('http://notes.demo-tailnet.ts.net/')
  const [result, setResult] = useState<Result | null>(null)

  const send = async (target: string, init?: RequestInit) => {
    setResult({ status: '…', via: '', body: '' })
    try {
      const res = await fetch(target, init)
      const via = res.headers.get('x-bl-tailscale') ?? 'network'
      setResult({ status: `${res.status}`, via, body: '' })
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
      <p className="m-0 text-footnote" data-testid="router-status" data-status={router.status}>
        Service worker: {router.status}{router.detail ? ` (${router.detail})` : ''} · {router.routed} routed
      </p>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void send(url) }}>
        <Input aria-label="URL" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button type="submit" variant="secondary">Fetch</Button>
      </form>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onPress={() => void send('http://notes.demo-tailnet.ts.net/echo', { method: 'POST', body: 'hello over the tailnet' })}>POST echo</Button>
        <Button size="sm" variant="secondary" onPress={() => void send('http://notes.demo-tailnet.ts.net/stream')}>Stream</Button>
        <Button size="sm" variant="secondary" onPress={() => void send('http://100.101.102.103/ping')}>100.101.102.103</Button>
        <Button size="sm" variant="secondary" onPress={() => void send(new URL(`${import.meta.env.BASE_URL}favicon.ico`, location.origin).href)}>Same origin</Button>
        <Button size="sm" variant="ghost" onPress={() => void router.router?.unregister()}>Remove service worker</Button>
      </div>
      <output aria-live="polite" className="grid gap-1 text-footnote">
        {result ? (
          <>
            <span><strong data-testid="result-status">{result.status}</strong> · via <strong data-testid="result-via">{result.via}</strong></span>
            <pre data-testid="result-body" className="m-0 whitespace-pre-wrap break-all">{result.body}</pre>
          </>
        ) : <span>Nothing sent yet.</span>}
      </output>
    </div>
  )
}

function Router() {
  const [fake] = useState(routerTailnet)
  return (
    <TailscaleProvider options={{ client: fake.client, popup: false, lockName: 'harness-router' }}>
      <div className="flex flex-wrap items-center gap-3">
        <TailscaleLoginButton />
        <TailscaleStatusBadge compact />
      </div>
      <Console />
    </TailscaleProvider>
  )
}

function SafariOnDemoTailnet() {
  const [demo] = useState(createDemoTailnet)
  return (
    <div className="relative h-[720px] overflow-hidden rounded-card shadow-hairline">
      <Safari tailscale={demo.options} />
    </div>
  )
}

const HARNESSES: Record<string, () => React.ReactElement> = {
  'tailscale-sign-in': () => <SignIn />,
  'tailscale-auth-key': () => <AuthKey />,
  'tailscale-router': () => <Router />,
  safari: () => <SafariOnDemoTailnet />,
}

export default function E2eHarness({ name }: { name: string }) {
  const render = HARNESSES[name]
  return <div className="mx-auto grid w-full max-w-5xl gap-3 p-4">{render ? render() : <p>No harness named {name}.</p>}</div>
}
