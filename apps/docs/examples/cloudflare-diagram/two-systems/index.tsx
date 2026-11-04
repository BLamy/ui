import { useState } from 'react'
import { CloudflareDiagram } from '@/components/ui/cloudflare-diagram'
import { sharedServices, validateSystem, type CloudflareSystem } from '@/lib/cloudflare-system'

const ROOM = { id: 'room', initial: 'empty', states: { empty: { on: { JOIN: 'full' } }, full: { on: { LEAVE: 'empty' } } } }
const SHARED = { id: 'room', kind: 'durable-objects', label: 'Room', machine: ROOM, at: { x: 340, y: 0 } }

const SITE: CloudflareSystem = {
  services: [{ id: 'site', kind: 'workers', label: 'Site', at: { x: 0, y: 0 } }, SHARED],
  edges: [{ id: 'site-room', from: 'site', to: 'room', via: 'durable_objects', binding: 'ROOM', events: ['JOIN'] }],
}
const ADMIN: CloudflareSystem = {
  services: [{ id: 'admin', kind: 'workers', label: 'Admin', at: { x: 0, y: 0 } }, SHARED],
  edges: [{ id: 'admin-room', from: 'admin', to: 'room', via: 'durable_objects', binding: 'ROOMS', events: ['LEAVE'] }],
}

function Side({ name, system, onChange }: { name: string; system: CloudflareSystem; onChange: (next: CloudflareSystem) => void }) {
  return (
    <div className="relative min-h-0" data-demo-side={name} data-demo-services={system.services.map((s) => s.id).join(' ')} data-demo-problems={validateSystem(system).map((i) => i.code).join(' ')}>
      <CloudflareDiagram editable services={system.services} edges={system.edges} onChange={(c) => onChange({ services: c.services, edges: c.edges })} aria-label={name} />
    </div>
  )
}

// Two systems can both have a service. Each is its own document, so taking it out of one, or changing its machine there, leaves the other as it was.
export default function TwoSystems() {
  const [site, setSite] = useState(SITE)
  const [admin, setAdmin] = useState(ADMIN)
  const shared = sharedServices(site, admin)
  return (
    <div className="grid h-full min-h-[1000px] w-full grid-rows-[1fr_1fr_auto] gap-2">
      <Side name="Site" system={site} onChange={setSite} />
      <Side name="Admin" system={admin} onChange={setAdmin} />
      <p data-demo-shared={shared.map((s) => `${s.id}:${s.sameMachine ? 'same' : 'differs'}`).join(' ')} className="m-0 border-t border-border p-3 text-footnote text-foreground">
        {shared.length ? `They share ${shared.map((s) => `${s.id}${s.sameMachine ? '' : ', with a different machine in each'}`).join(', ')}.` : 'They share nothing.'}
      </p>
    </div>
  )
}
