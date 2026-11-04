import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram'
import { SERVICE_PRODUCTS } from '@/lib/cloudflare-services'

const SERVICES = SERVICE_PRODUCTS.map((p) => ({ id: p.id, kind: p.id }))

// All of them, placed by ELK. Any of them can go on a diagram, with whatever it has to connect.
export default function EveryService() {
  return (
    <div className="relative h-full min-h-[640px] w-full">
      <CloudflareDiagram services={SERVICES} defaultPanelOpen={false} aria-label="Every service in the catalog" />
    </div>
  )
}
