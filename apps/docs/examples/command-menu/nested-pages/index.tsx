import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import {
  CommandMenu, CommandMenuEmpty, CommandMenuFooter, CommandMenuGroup, CommandMenuGroupLabel, CommandMenuInput, CommandMenuItem,
  CommandMenuList, CommandMenuPage, CommandMenuShortcut,
} from '@/components/ui/command-menu'

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

/** Keys the app handles itself: shown, not registered, so the demo never takes them from the page.
    `shortcut` on a command would register them and run it. */
const keys = (shortcut: string) => <CommandMenuShortcut shortcut={shortcut} />

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
        <CommandMenuInput placeholder="Search commands and projects…" />
        <CommandMenuEmpty>No matching commands</CommandMenuEmpty>
        <CommandMenuList className="max-h-80">
          <CommandMenuPage>
            <CommandMenuGroup>
              <CommandMenuGroupLabel>Actions</CommandMenuGroupLabel>
              <CommandMenuItem
                icon="square-pencil"
                title="New thread in ui"
                trailing={keys('mod+shift+o')}
                onSelect={() => setLast('New thread in ui')}
              />
              {/* `page` opens a page and shows the chevron */}
              <CommandMenuItem icon="square-pencil" title="New thread in…" page="projects" />
              <CommandMenuItem
                icon="link"
                title="Copy thread ID"
                description="b7578c63-c54a-4669-a6a1-51348cf0177b"
                trailing={keys('mod+shift+c')}
                onSelect={() => setLast('Copied thread ID')}
              />
              <CommandMenuItem icon="branch" title="Show linked pull requests" disabled />
              <CommandMenuItem icon="folder-plus" title="Add project" page="sources" chevron={false} />
            </CommandMenuGroup>
          </CommandMenuPage>
          {/* numbered: ⌘1–⌘9 shown on the first nine visible rows */}
          <CommandMenuPage value="projects" title="Projects" numbered>
            <CommandMenuGroup>
              <CommandMenuGroupLabel>Projects</CommandMenuGroupLabel>
              {projects.map((p) => (
                <CommandMenuItem
                  key={p.name}
                  icon={<Monogram {...p} />}
                  title={p.name}
                  description={`Local · ${p.path}`}
                  onSelect={() => setLast(`New thread in ${p.name}`)}
                />
              ))}
            </CommandMenuGroup>
          </CommandMenuPage>
          <CommandMenuPage value="sources" title="Add project">
            <CommandMenuGroup>
              <CommandMenuGroupLabel>Sources</CommandMenuGroupLabel>
              <CommandMenuItem icon="folder-plus" title="Local folder" description="Browse a folder on disk" onSelect={() => setLast('Local folder')} />
              <CommandMenuItem icon="link" title="Git URL" description="Clone from a remote URL" onSelect={() => setLast('Git URL')} />
              {/* dimmed: greyed but still runnable */}
              <CommandMenuItem
                icon="network"
                title="Bitbucket repository"
                description="Clone Bitbucket workspace/repository"
                dimmed
                trailing={setupRequired}
                onSelect={() => setLast('Bitbucket needs setup')}
              />
            </CommandMenuGroup>
          </CommandMenuPage>
        </CommandMenuList>
        <CommandMenuFooter />
      </CommandMenu>
      <div style={{ fontSize: 13, color: 'var(--muted-foreground)' }}>
        Last action: <b style={{ color: 'var(--foreground)' }}>{last}</b>
      </div>
    </div>
  )
}
