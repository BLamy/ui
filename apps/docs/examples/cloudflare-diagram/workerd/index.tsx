import { useMemo, useState } from 'react'
import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram'
import { Textarea } from '@/components/ui/textarea'
import { placeInLayers } from '@/lib/cloudflare-system'
import { readWorkerdConfig } from '@/lib/cloudflare-workerd'

const CONFIG = `using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "main", worker = .main),
    (name = "broker", worker = .broker),
    (name = "consumer", worker = .consumer),
    (name = "do-storage", disk = (path = "do-storage", writable = true)),
  ],
  sockets = [ (name = "http", address = "127.0.0.1:19810", http = (), service = "main") ],
);

const main :Workerd.Worker = (
  modules = [ (name = "worker.js", esModule = embed "worker.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [
    (name = "ORDERS", durableObjectNamespace = "Order"),
    (name = "QUEUE", queue = "broker"),
  ],
  durableObjectNamespaces = [ (className = "Order", uniqueKey = "orders", enableSql = true) ],
  durableObjectStorage = (localDisk = "do-storage"),
);

const broker :Workerd.Worker = (
  modules = [ (name = "broker.js", esModule = embed "broker.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [ (name = "CONSUMER", service = "consumer") ],
);

const consumer :Workerd.Worker = (
  modules = [ (name = "consumer.js", esModule = embed "consumer.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [ (name = "ORDERS", durableObjectNamespace = (className = "Order", serviceName = "main")) ],
);
`

// A workerd config, read into a system and drawn. Change the text and it's read again: a class bound from another Worker, a queue, a
// service binding. What isn't one of Cloudflare's services, like a disk or a socket, is listed under it.
export default function Workerd() {
  const [text, setText] = useState(CONFIG)
  const read = useMemo(() => readWorkerdConfig(text), [text])
  const system = useMemo(() => (read.ok ? placeInLayers(read.system) : null), [read])
  return (
    <div className="grid h-full min-h-[760px] w-full grid-rows-[1fr_auto]">
      <div className="relative min-h-0">
        {system ? <CloudflareDiagram services={system.services} edges={system.edges} aria-label="A workerd config, as Cloudflare services" /> : null}
      </div>
      <div className="flex flex-col gap-2 border-t border-border p-3 text-footnote text-foreground">
        <Textarea aria-label="config.capnp" data-demo-config rows={9} value={text} onValueChange={setText} className="font-mono" />
        {read.ok ? (
          <ul data-demo-notes className="m-0 flex list-none flex-col gap-1 p-0 text-foreground/70">
            {read.notes.map((n, i) => <li key={i} data-code={n.code}>{n.message}</li>)}
          </ul>
        ) : (
          <p data-demo-unreadable className="m-0 text-destructive">{read.reason}</p>
        )}
      </div>
    </div>
  )
}
