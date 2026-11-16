import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram'
import { Textarea } from '@/components/ui/textarea'
import { parseSystem, systemToJson, type CloudflareSystem, type SystemIssue } from '@/lib/cloudflare-system'

const ROOM = {
  id: 'room',
  initial: 'empty',
  states: {
    empty: { on: { VIEWER_JOINED: 'watched' } },
    watched: { on: { VIEWER_LEFT: 'empty', FILE_READY: 'watched' } },
  },
}

const START: CloudflareSystem = {
  services: [
    { id: 'api', kind: 'workers', label: 'API', at: { x: 0, y: 40 } },
    { id: 'files', kind: 'r2', label: 'Files', binding: 'FILES', at: { x: 340, y: 0 } },
    { id: 'jobs', kind: 'queues', at: { x: 340, y: 120 } },
    { id: 'consumer', kind: 'workers', label: 'Consumer', at: { x: 680, y: 60 } },
    { id: 'room', kind: 'durable-objects', label: 'Room', machine: ROOM, at: { x: 1020, y: 60 } },
  ],
  edges: [
    { id: 'upload', from: 'api', to: 'files', via: 'r2_buckets', operations: ['put'] },
    { id: 'enqueue', from: 'api', to: 'jobs', via: 'queues', binding: 'JOBS', operations: ['send'] },
    { id: 'consume', from: 'jobs', to: 'consumer', via: 'queue-consumer' },
    { id: 'tell-room', from: 'consumer', to: 'room', via: 'durable_objects', binding: 'ROOM', events: ['FILE_READY'] },
  ],
}

// A system's only data. Search for a service to add one, or give a connection some events, and it says if something can't receive them. It saves as JSON, and a file that's been edited by hand can be loaded: what it can't use is left out, and said.
export default function System() {
  const [system, setSystem] = useState(START)
  const [text, setText] = useState(() => systemToJson(START))
  const [loaded, setLoaded] = useState<SystemIssue[]>([])
  const change = (next: CloudflareSystem) => {
    setSystem(next)
    setText(systemToJson(next))
    setLoaded([])
  }
  const load = () => {
    const read = parseSystem(text)
    setLoaded(read.issues)
    if (read.issues.some((i) => i.code === 'json' || i.code === 'shape')) return
    setSystem(read.system)
  }
  return (
    <div className="grid h-full min-h-[820px] w-full grid-rows-[1fr_auto]">
      <div className="relative min-h-0">
        <CloudflareDiagram editable services={system.services} edges={system.edges} onDataChange={change} aria-label="A file upload, as a system" />
      </div>
      <div className="flex flex-col gap-2 border-t border-border p-3 text-footnote text-foreground">
        <Textarea aria-label="The system, as JSON" data-demo-json rows={6} value={text} onValueChange={setText} className="font-mono" />
        <div><Button data-demo-load variant="secondary" size="sm" onClick={load}>Load this</Button></div>
        {loaded.length ? (
          <ul data-demo-load-issues className="m-0 flex list-none flex-col gap-1 p-0">
            {loaded.map((i, n) => <li key={n} data-code={i.code} className={i.severity === 'error' ? 'text-destructive' : ''}>{i.message}</li>)}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
