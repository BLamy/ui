import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CodeEditor, type CodeEditorChange, type CodeEditorGutter, type CodeEditorHandle } from '@/components/ui/code-editor'
import { Input } from '@/components/ui/input'
import Safari from '@/components/blocks/safari/page'
import VSCode from '@/components/blocks/vscode/page'
import MacOS from '@/components/blocks/macos/page'
import { createTailscale } from '@/lib/tailscale'
import ReplayCanvas, { type Recording } from '@/components/blocks/replay-canvas/page'
import { createDemoTailnet } from '@/components/blocks/safari/data'
import { TailscaleLoginButton, TailscaleStatusBadge } from '@/components/ui/tailscale-login-button'
import { createFakeTailscaleClient } from '@/lib/tailscale-fake'
import { TailscaleProvider, useTailscaleStatus } from '@/lib/tailscale-react'
import { useTailscaleRouter } from '@/lib/tailscale-router/react'

/* Test tooling, not a demo: `?harness=<name>` (dev server only; main.tsx never loads this in a production build)
   renders the Tailscale components on an in-memory tailnet, so tools/e2e can drive them without a Tailscale account.
   The docs demos themselves run on the real tailnet and have no fake mode. CodeEditor is here for what a demo doesn't show:
   the text and the changes behind what's on screen. */

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

function VSCodeOnDemoTailnet({ desktop = false }: { desktop?: boolean }) {
  const [controller] = useState(() => createTailscale({
    client: routerTailnet().client,
    auth: { mode: 'auth-key', authKey: 'demo-not-a-real-key' },
    lockName: 'harness-vscode',
  }))
  return <div className="fixed inset-0">{desktop ? <MacOS controller={controller} /> : <VSCode controller={controller} />}</div>
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

/** One downloaded Replay QA test run (tools/replay-canvas/serve-recordings.mjs serving `?dir=<project>/<test run>`) in
 *  Replay Canvas, full screen: how tools/replay-canvas/evaluate.mjs studies the breakdown. */
function ReplayCanvasLocal() {
  const params = new URLSearchParams(window.location.search)
  const base = params.get('recordings') ?? 'http://127.0.0.1:4436'
  const dir = params.get('dir') ?? ''
  const [recordings, setRecordings] = useState<Recording[] | null>(null)
  useEffect(() => {
    void (async () => {
      const manifest = await (await fetch(`${base}/${dir}/manifest.json`)).json() as { journeys: { run: string; journey?: string; file?: string }[] }
      const files = manifest.journeys.filter((j) => j.file)
      setRecordings(await Promise.all(files.map(async (j) => ({ id: j.run, name: j.journey || j.run, events: await (await fetch(`${base}/${dir}/${j.file}`)).json() }))))
    })()
  }, [base, dir])
  return recordings ? <div className="fixed inset-0" data-harness-ready><ReplayCanvas recordings={recordings} /></div> : <p>Loading {dir}…</p>
}

/** CodeEditor under test. The query says what to edit and how (`doc`, `wrap`, `gutters`, `mode`, `readOnly`), and `window.__editor` is
 *  how tools/e2e reads what happened, since what's on screen is only part of it. */
const HARNESS_DOCS: Record<string, () => string> = {
  small: () => ['function greet(name) {', '  return `Hello, ${name}`;', '}', '', 'greet("world");'].join('\n'),
  ninety: () => Array.from({ length: 99 }, (_, i) => `const line${i + 1} = ${i + 1};`).join('\n'),
  empty: () => '',
  tabs: () => ['function f() {', '\tif (x) {', '\t\treturn 1;', '\t}', '}'].join('\n'),
  long: () => `first line\n${Array.from({ length: 60 }, (_, i) => `const value${i} = compute(${i}, "some text to fill the line up");`).join(' ')}\nlast line`,
  'many-lines': () => Array.from({ length: 500_000 }, (_, i) => `const value${i} = compute(${i});`).join('\n'),
  'long-line': () => {
    const pieces = ['function a(b,c){return b+c}', 'var d="it",f=\'b\';', 'g=h/2/i;', 'if(m)n.o(p)&&q();', 'r=s?.t??u;', 'for(let i=0;i<10;i++)z[i]=i*1.5;'];
    let out = ''
    for (let i = 0; out.length < 1 << 20; i++) out += pieces[i % pieces.length]
    return `first line\n${out}\nlast line`
  },
}

function CodeEditorHarness() {
  const params = new URLSearchParams(window.location.search)
  const docName = params.get('doc') ?? 'small'
  const initial = useMemo(() => (HARNESS_DOCS[docName] ?? HARNESS_DOCS.small)(), [docName])
  const mode = params.get('mode') ?? 'uncontrolled'
  const [value, setValue] = useState(initial)
  const editor = useRef<CodeEditorHandle>(null)
  const changes = useRef<CodeEditorChange[]>([])
  const onChangeCalls = useRef(0)
  const [breakpoints] = useState(() => new Set([2]))
  const gutters = useMemo<CodeEditorGutter[] | undefined>(() => (params.get('gutters') ? [{
    id: 'breakpoint',
    width: 18,
    onPress: () => {},
    label: (line) => `Breakpoint on line ${line}`,
    render: (line) => (breakpoints.has(line) ? <span data-testid="breakpoint" className="size-2 rounded-full bg-warning" /> : null),
  }] : undefined), [breakpoints])
  useEffect(() => {
    Object.assign(window, { __editor: { handle: editor, changes, onChangeCalls, setValue, value: () => value } })
  })
  const shared = {
    ref: editor,
    language: 'js',
    wrap: !!params.get('wrap'),
    gutters,
    'aria-label': 'the code',
    title: params.get('title') ?? undefined,
    showCopy: !!params.get('copy'),
    variant: (params.get('variant') ?? 'default') as 'default' | 'ghost',
  }
  const size = params.get('auto') ? '' : 'h-[420px]'
  return (
    <div data-harness-ready className="grid gap-2">
      <button type="button" data-testid="before">before</button>
      <div className={size} data-testid="frame">
        {params.get('readOnly') ? (
          <CodeEditor {...shared} readOnly value={value} windowed={params.get('windowed') ? true : undefined} />
        ) : mode === 'controlled' ? (
          <CodeEditor {...shared} value={value} onChange={(next, change) => { onChangeCalls.current++; changes.current.push(change); setValue(next) }} />
        ) : mode === 'upper' ? (
          <CodeEditor {...shared} value={value} onChange={(next, change) => { changes.current.push(change); setValue(next.toUpperCase()) }} />
        ) : mode === 'rejects' ? (
          <CodeEditor {...shared} value={value} onChange={(_, change) => { changes.current.push(change) }} />
        ) : (
          <CodeEditor {...shared} defaultValue={initial} onEdit={(change) => { changes.current.push(change) }} />
        )}
      </div>
      <button type="button" data-testid="after">after</button>
    </div>
  )
}

const HARNESSES: Record<string, () => React.ReactElement> = {
  'code-editor': () => <CodeEditorHarness />,
  'tailscale-sign-in': () => <SignIn />,
  'tailscale-auth-key': () => <AuthKey />,
  'tailscale-router': () => <Router />,
  safari: () => <SafariOnDemoTailnet />,
  vscode: () => <VSCodeOnDemoTailnet />,
  'macos-vscode': () => <VSCodeOnDemoTailnet desktop />,
  'replay-canvas-local': () => <ReplayCanvasLocal />,
}

export default function E2eHarness({ name }: { name: string }) {
  const render = HARNESSES[name]
  return <div className="mx-auto grid w-full max-w-5xl gap-3 p-4">{render ? render() : <p>No harness named {name}.</p>}</div>
}
