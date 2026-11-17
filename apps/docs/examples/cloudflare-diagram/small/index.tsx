import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram'
import type { CloudflareEdge, CloudflareService } from '@/lib/cloudflare-services'

// A link shortener: one Worker on a route, its links in KV and its clicks in D1.
const SERVICES: CloudflareService[] = [
  {
    id: 'shortener',
    kind: 'workers',
    label: 'Shortener',
    triggers: [{ kind: 'route', pattern: 'sho.rt/*', zone: 'sho.rt' }],
    settings: { compatibilityDate: '2026-11-01' },
  },
  { id: 'links', kind: 'kv', label: 'Links' },
  { id: 'clicks', kind: 'd1', label: 'Clicks', resource: 'clicks' },
]

const EDGES: CloudflareEdge[] = [
  { id: 'shortener-links', from: 'shortener', to: 'links', via: 'kv_namespaces', binding: 'LINKS', operations: ['get', 'put'] },
  { id: 'shortener-clicks', from: 'shortener', to: 'clicks', via: 'd1_databases', binding: 'DB', operations: ['prepare', 'batch'] },
]

export default function Small() {
  return (
    <div className="relative h-full min-h-[560px] w-full">
      <CloudflareDiagram services={SERVICES} edges={EDGES} title="Link shortener" defaultPanelOpen={false} aria-label="A link shortener" />
    </div>
  )
}
