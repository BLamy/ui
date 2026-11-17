import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram'
import type { CloudflareEdge, CloudflareService } from '@/lib/cloudflare-services'

// Docs search, in two environments: a gateway on a route and a custom domain calls the Search Worker's entrypoint through a
// service binding; an indexer runs on a schedule and through a queue with a dead-letter queue, embedding with Workers AI
// into a Vectorize index. Staging has a gateway of its own on workers.dev. Workers AI is the account's, not an environment's.
const P = 'production'
const DATE = '2026-11-01'
const SERVICES: CloudflareService[] = [
  {
    id: 'gateway', kind: 'workers', label: 'Gateway', environment: P,
    triggers: [{ kind: 'route', pattern: 'api.example.com/*', zone: 'example.com' }, { kind: 'route', pattern: 'search.example.com', customDomain: true }],
    settings: { compatibilityDate: DATE, placement: 'smart', observability: true, headSamplingRate: 0.1 },
  },
  { id: 'search', kind: 'workers', label: 'Search', environment: P, settings: { compatibilityDate: DATE, cpuMs: 50 } },
  { id: 'indexer', kind: 'workers', label: 'Indexer', environment: P, triggers: [{ kind: 'cron', schedule: '0 */6 * * *' }], settings: { compatibilityDate: DATE } },
  { id: 'cache', kind: 'kv', label: 'Cache', environment: P },
  { id: 'requests', kind: 'workers-analytics-engine', label: 'Requests', resource: 'requests', environment: P },
  { id: 'docs-index', kind: 'vectorize', label: 'Docs index', resource: 'docs-index', environment: P },
  { id: 'docs', kind: 'd1', label: 'Docs', resource: 'docs', environment: P },
  { id: 'crawl', kind: 'queues', label: 'Crawl', resource: 'crawl', environment: P },
  { id: 'crawl-dlq', kind: 'queues', label: 'crawl-dlq', resource: 'crawl-dlq', environment: P },
  { id: 'ai', kind: 'workers-ai' },
  { id: 'gateway-staging', kind: 'workers', label: 'Gateway', environment: 'staging', triggers: [{ kind: 'workers-dev' }], settings: { compatibilityDate: DATE } },
  { id: 'cache-staging', kind: 'kv', label: 'Cache', environment: 'staging' },
]

const EDGES: CloudflareEdge[] = [
  { id: 'gateway-search', from: 'gateway', to: 'search', via: 'services', binding: 'SEARCH', entrypoint: 'SearchService', operations: ['fetch'] },
  { id: 'gateway-cache', from: 'gateway', to: 'cache', via: 'kv_namespaces', binding: 'CACHE', operations: ['get', 'put'] },
  { id: 'gateway-requests', from: 'gateway', to: 'requests', via: 'analytics_engine_datasets', binding: 'REQUESTS', operations: ['writeDataPoint'] },
  { id: 'search-ai', from: 'search', to: 'ai', via: 'ai', binding: 'AI', operations: ['run'] },
  { id: 'search-index', from: 'search', to: 'docs-index', via: 'vectorize', binding: 'INDEX', operations: ['query'] },
  { id: 'search-docs', from: 'search', to: 'docs', via: 'd1_databases', binding: 'DOCS', operations: ['prepare'] },
  { id: 'indexer-crawl', from: 'indexer', to: 'crawl', via: 'queues', binding: 'CRAWL', operations: ['send'] },
  { id: 'crawl-indexer', from: 'crawl', to: 'indexer', via: 'queue-consumer', consumer: { batchSize: 25, retries: 5, deadLetterQueue: 'crawl-dlq' } },
  { id: 'indexer-ai', from: 'indexer', to: 'ai', via: 'ai', binding: 'AI', operations: ['run'] },
  { id: 'indexer-index', from: 'indexer', to: 'docs-index', via: 'vectorize', binding: 'INDEX', operations: ['upsert'] },
  { id: 'staging-cache', from: 'gateway-staging', to: 'cache-staging', via: 'kv_namespaces', binding: 'CACHE', operations: ['get', 'put'] },
]

export default function Platform() {
  return (
    <div className="relative h-full min-h-[640px] w-full">
      <CloudflareDiagram services={SERVICES} edges={EDGES} title="Docs search" accountId="4f1b9c2e7a" defaultPanelOpen={false} aria-label="Docs search, in production and staging" />
    </div>
  )
}
