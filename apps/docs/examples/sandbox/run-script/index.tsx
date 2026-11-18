import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import type { SandboxIsolation, SandboxProcess } from '@/lib/sandbox'
import { useSandbox } from '@/lib/sandbox/react'

// Written out, so that the bundler builds the Worker with the runtime in it.
const newWorker = () => new Worker(new URL('./sandbox.worker.ts', import.meta.url), { type: 'module' })

const SCRIPT = `const os = require('os')

console.log('Hello from', os.platform())
console.log('document:', typeof document)
console.log('localStorage:', typeof localStorage)
`

const PLACE: Record<SandboxIsolation, string> = {
  'opaque-origin': 'In a Worker with an origin of its own: no access to this page or its storage.',
  'same-origin': 'In a Worker of this site: no page, cookies or localStorage, but this site\'s IndexedDB and caches are within reach.',
}

function Runner({ isolation, runNow, onUseSameOrigin }: { isolation: SandboxIsolation; runNow: boolean; onUseSameOrigin: () => void }) {
  // Nothing loads until the first command: reading this page starts no Worker.
  const { sandbox, status, isolation: got, error } = useSandbox({ worker: newWorker, isolation, autoStart: false })
  const [code, setCode] = useState(SCRIPT)
  const [output, setOutput] = useState('')
  const [running, setRunning] = useState<SandboxProcess | null>(null)

  const run = async () => {
    if (!sandbox) return
    running?.kill()
    setOutput('')
    // Settles when the page's copy has it, even while a script holds the Worker's thread.
    await sandbox.files.write('index.js', code)
    const job = sandbox.run('node index.js', { onOutput: (chunk) => setOutput((text) => text + chunk) })
    setRunning(job)
    const { interrupted } = await job.exit
    setRunning((now) => (now === job ? null : now))
    if (interrupted === 'unresponsive') setOutput((text) => `${text}\n[It would not stop, so its Worker was replaced. The files are kept.]\n`)
  }

  const ran = useRef(false)
  useEffect(() => {
    if (!sandbox || !runNow || ran.current) return
    ran.current = true
    void run()
  })

  return (
    <div className="mx-auto grid w-full max-w-xl gap-3">
      <Textarea aria-label="index.js" className="font-mono text-footnote" rows={7} spellCheck={false} value={code} onChange={(event) => setCode(event.target.value)} />
      <div className="flex items-center gap-3">
        <Button variant="secondary" onClick={run} disabled={!sandbox}>Run</Button>
        {/* A `while (true) {}` holds only the Worker: Stop asks it to end, and replaces the Worker if it won't. */}
        <Button variant="outline" onClick={() => running?.kill()} disabled={!running}>Stop</Button>
        <p role="status" data-testid="sandbox-status" data-status={status} data-isolation={got ?? undefined} className="text-footnote text-foreground/65">
          {got ? PLACE[got] : status === 'idle' ? 'Nothing has started yet.' : status === 'failed' ? 'It did not start.' : 'Starting…'}
        </p>
      </div>
      {error ? (
        <div role="alert" className="grid gap-2 rounded-ctl bg-secondary p-3 text-footnote">
          <p>{error.message}</p>
          {error.code === 'isolation' ? (
            <Button size="sm" variant="outline" className="justify-self-start" onClick={onUseSameOrigin}>Run it in a same-origin Worker</Button>
          ) : null}
        </div>
      ) : null}
      <pre role="log" aria-label="Output" data-testid="sandbox-output" className="min-h-24 overflow-auto rounded-ctl bg-secondary p-3 font-mono text-footnote whitespace-pre-wrap">{output}</pre>
    </div>
  )
}

// The sandbox asks for an origin of its own and fails where the host can't give it one (a dev server
// without CORS headers). Running it without is a decision, here the reader's: it is never a silent fallback.
export default function RunScriptExample() {
  const [isolation, setIsolation] = useState<SandboxIsolation>('opaque-origin')
  return <Runner key={isolation} isolation={isolation} runNow={isolation === 'same-origin'} onUseSameOrigin={() => setIsolation('same-origin')} />
}
