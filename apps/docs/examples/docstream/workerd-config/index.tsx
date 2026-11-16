import { useState } from 'react'
import { MarkdownView } from '@/components/ui/markdown-view'
import { Segmented, SegmentedItem } from '@/components/ui/segmented'

const fence = (code: string) => '```capnp\n' + code + '\n```'

// A Worker with a Durable Object, a KV namespace and an R2 bucket; a disk and a socket, which aren't Cloudflare services and
// are listed under the board; and the same config with a bracket left open.
const CONFIG = `using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "main", worker = .main),
    (name = "do-storage", disk = (path = "do-storage", writable = true)),
  ],
  sockets = [ (name = "http", address = "*:8080", http = (), service = "main") ],
);

const main :Workerd.Worker = (
  modules = [ (name = "worker.js", esModule = embed "worker.js") ],
  compatibilityDate = "2026-01-01",
  bindings = [
    (name = "ROOMS", durableObjectNamespace = "Room"),
    (name = "SESSIONS", kvNamespace = "sessions"),
    (name = "UPLOADS", r2Bucket = "uploads"),
  ],
  durableObjectNamespaces = [ (className = "Room", uniqueKey = "rooms", enableSql = true) ],
  durableObjectStorage = (localDisk = "do-storage"),
);`

const DOCUMENTS = {
  config: `A chat app's \`config.capnp\`, drawn by the Markdown that holds it:\n\n${fence(CONFIG)}\n`,
  unreadable: `The same config with a bracket left open says where:\n\n${fence(CONFIG.replace('(name = "main", worker = .main),', '(name = "main", worker = .main,'))}\n`,
}

/** A `capnp` fence that's a workerd config, through MarkdownView: the services it runs on a read-only CloudflareDiagram. */
export default function WorkerdConfig() {
  const [doc, setDoc] = useState<keyof typeof DOCUMENTS>('config')
  return (
    <div className="flex w-full min-w-0 flex-col gap-3">
      <Segmented aria-label="Document" size="sm" value={doc} onValueChange={(v) => setDoc(v as keyof typeof DOCUMENTS)}>
        <SegmentedItem value="config">A workerd config</SegmentedItem>
        <SegmentedItem value="unreadable">One that doesn’t read</SegmentedItem>
      </Segmented>
      <MarkdownView markdown={DOCUMENTS[doc]} />
    </div>
  )
}
