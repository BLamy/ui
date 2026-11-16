import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram'
import { Textarea } from '@/components/ui/textarea'
import type { CloudflareSystem } from '@/lib/cloudflare-system'
import { compareWrangler, readWrangler, writeWrangler } from '@/lib/cloudflare-wrangler'

const CONFIG = `// The API's Worker, kept by hand.
{
  "name": "api", // what it's deployed as
  "main": "src/index.ts",
  "compatibility_date": "2026-10-01",

  // Where uploads go.
  "r2_buckets": [
    { "binding": "FILES", "bucket_name": "uploads" } // the big one
  ],
  "kv_namespaces": [{ "binding": "SESSIONS", "id": "abc123" }],
  "durable_objects": { "bindings": [{ "name": "ROOM", "class_name": "Room" }] }
}
`

const NOTHING: CloudflareSystem = { services: [], edges: [] }
const asSystem = (text: string) => {
  const read = readWrangler(text)
  return read.ok ? read.system : NOTHING
}

// A config, read into a system. Change it on the board, and the differences are listed by name. Writing them back edits the file's text, so its comments stay.
export default function Wrangler() {
  const [text, setText] = useState(CONFIG)
  const [system, setSystem] = useState(() => asSystem(CONFIG))
  const read = useMemo(() => readWrangler(text), [text])
  const compared = useMemo(() => compareWrangler(text, system), [text, system])
  const write = () => {
    const written = writeWrangler(text, system)
    if (written.ok) setText(written.text)
  }
  return (
    <div className="grid h-full min-h-[820px] w-full grid-rows-[1fr_auto]">
      <div className="relative min-h-0">
        <CloudflareDiagram editable services={system.services} edges={system.edges} onChange={(c) => setSystem({ services: c.services, edges: c.edges })} aria-label="A Worker's config, as a system" />
      </div>
      <div className="flex flex-col gap-2 border-t border-border p-3 text-footnote text-foreground">
        <Textarea aria-label="wrangler.jsonc" data-demo-config rows={9} value={text} onChange={(e) => setText(e.target.value)} className="font-mono" />
        <div className="flex gap-2">
          <Button data-demo-read variant="secondary" size="sm" onPress={() => setSystem(asSystem(text))}>Read the file</Button>
          <Button data-demo-write variant="secondary" size="sm" isDisabled={!compared.ok} onPress={write}>Write to the file</Button>
        </div>
        {!read.ok ? <p data-demo-unreadable className="m-0 text-destructive">{read.reason}</p> : null}
        {compared.ok ? (
          <ul data-demo-differences={compared.differences.map((d) => `${d.kind}:${d.name}`).join(' ')} className="m-0 flex list-none flex-col gap-1 p-0">
            {compared.differences.length ? compared.differences.map((d) => <li key={`${d.kind}:${d.key}:${d.name}`}>{d.message}</li>) : <li>The system and the file agree.</li>}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
