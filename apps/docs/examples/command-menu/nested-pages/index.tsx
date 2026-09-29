import { useState } from 'react'
import {
  Badge,
  CommandEmpty,
  CommandFooter,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandMenu,
  CommandPage,
} from '@brett_lamy/ui'

const projects = [
  { name: 'ui', path: '~/Code/ui', color: '#30D158' },
  { name: 'wasm-vm', path: '~/Code/wasm-vm', color: '#FFD60A' },
  { name: 'electric-forest', path: '~/Code/electric-forest', color: '#A4E34F' },
  { name: 'docs-site', path: '~/Code/docs-site', color: '#64D2FF' },
]

function Monogram({ name, color }: { name: string; color: string }) {
  const [a, b] = name.split('-')
  return (
    <span
      style={{
        display: 'grid',
        placeItems: 'center',
        width: 22,
        height: 22,
        borderRadius: 5,
        font: '700 10px ui-monospace, Menlo, monospace',
        color,
        background: `color-mix(in oklab, ${color} 17%, transparent)`,
      }}
    >
      {(b ? a[0] + b[0] : name.slice(0, 2)).toUpperCase()}
    </span>
  )
}

const setupRequired = (
  <Badge variant="outline" style={{ borderRadius: 6, color: 'var(--warning)' }}>
    Setup Required
  </Badge>
)

export default function NestedPages() {
  const [last, setLast] = useState('Nothing yet')
  return (
    <div style={{ display: 'grid', gap: 12, width: 'min(560px, 100%)' }}>
      <CommandMenu aria-label="Command menu">
        <CommandInput placeholder="Search commands and projects…" />
        <CommandList maxHeight={320}>
          <CommandEmpty>No matching commands</CommandEmpty>
          <CommandPage id="root">
            <CommandGroup heading="Actions">
              <CommandItem
                icon="square-pencil"
                title="New thread in ui"
                shortcut="⇧⌘O"
                onSelect={() => setLast('New thread in ui')}
              />
              {/* `page` pushes a page and shows the chevron */}
              <CommandItem icon="square-pencil" title="New thread in…" page="projects" />
              <CommandItem
                icon="link"
                title="Copy thread ID"
                description="b7578c63-c54a-4669-a6a1-51348cf0177b"
                shortcut="⇧⌘C"
                onSelect={() => setLast('Copied thread ID')}
              />
              <CommandItem icon="branch" title="Show linked pull requests" disabled />
              <CommandItem icon="folder-plus" title="Add project" page="sources" chevron={false} />
            </CommandGroup>
          </CommandPage>
          {/* numbered: ⌘1–⌘9 shown on the first nine visible rows */}
          <CommandPage id="projects" numbered>
            <CommandGroup heading="Projects">
              {projects.map((p) => (
                <CommandItem
                  key={p.name}
                  icon={<Monogram {...p} />}
                  title={p.name}
                  description={`Local · ${p.path}`}
                  onSelect={() => setLast(`New thread in ${p.name}`)}
                />
              ))}
            </CommandGroup>
          </CommandPage>
          <CommandPage id="sources">
            <CommandGroup heading="Sources">
              <CommandItem icon="folder-plus" title="Local folder" description="Browse a folder on disk" onSelect={() => setLast('Local folder')} />
              <CommandItem icon="link" title="Git URL" description="Clone from a remote URL" onSelect={() => setLast('Git URL')} />
              {/* dimmed: greyed but still selectable */}
              <CommandItem
                icon="network"
                title="Bitbucket repository"
                description="Clone Bitbucket workspace/repository"
                dimmed
                badge={setupRequired}
                onSelect={() => setLast('Bitbucket needs setup')}
              />
            </CommandGroup>
          </CommandPage>
        </CommandList>
        <CommandFooter />
      </CommandMenu>
      <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
        Last action: <b style={{ color: 'var(--foreground)' }}>{last}</b>
      </div>
    </div>
  )
}
