import { useState, type ReactNode } from 'react'
import {
  useAppearance,
  WorkspaceRail,
  WorkspaceRailAction,
  WorkspaceRailHome,
  WorkspaceRailItem,
  WorkspaceRailList,
  WorkspaceRailSeparator,
  themeScopeProps,
} from '@brett_lamy/ui'

const servers = [
  { id: 'design', label: 'D', color: '#0A84FF', title: 'Design Team' },
  {
    id: 'eng',
    label: 'E',
    color: '#BF5AF2',
    title: 'Engineering',
    unread: true,
  },
  { id: 'ops', label: 'O', color: '#FF9F0A', title: 'Ops', mentions: 3 },
]
const channels: Record<string, string[]> = {
  home: ['Maya Lindqvist', 'Jonas Ito'],
  design: ['general', 'critique', 'inspiration'],
  eng: ['general', 'deploys', 'incidents'],
  ops: ['general', 'on-call'],
}

function ChatWorkspaces() {
  const [server, setServer] = useState('design')
  // A chat theme scope that follows light / dark.
  const appearance = useAppearance() ?? 'light'
  return (
    <div
      {...themeScopeProps({ scope: 'chat', appearance })}
      style={{
        display: 'flex',
        height: 340,
        background: 'var(--background)',
        color: 'var(--foreground)',
      }}
    >
      <WorkspaceRail selectedKey={server} onSelectionChange={setServer}>
        <WorkspaceRailList>
          <WorkspaceRailHome mentions={1} />
          <WorkspaceRailSeparator />
          {servers.map((s) => (
            <WorkspaceRailItem key={s.id} {...s} />
          ))}
        </WorkspaceRailList>
        <WorkspaceRailAction aria-label="Add workspace" />
      </WorkspaceRail>
      <nav
        style={{
          width: 190,
          padding: '14px 8px',
          background: 'var(--sidebar)',
          borderRight: '1px solid var(--border)',
        }}
      >
        <div style={{ padding: '0 8px 10px', fontWeight: 700 }}>
          {server === 'home'
            ? 'Direct Messages'
            : servers.find((s) => s.id === server)?.title}
        </div>
        {channels[server].map((c, i) => (
          <div
            key={c}
            style={{
              padding: '6px 8px',
              borderRadius: 7,
              fontSize: 13.5,
              background: i === 0 ? 'var(--secondary-strong)' : undefined,
              color: i === 0 ? 'var(--foreground)' : 'var(--muted-foreground)',
            }}
          >
            {server === 'home' ? c : `# ${c}`}
          </div>
        ))}
      </nav>
      <main
        style={{ flex: 1, padding: 20, fontSize: 13.5, color: 'var(--muted-foreground)' }}
      >
        Up / Down moves between workspaces; the pill marks unread, hover and
        selection.
      </main>
    </div>
  )
}

/** The rounded, hairline-bordered window the example sits in. */
function Window({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--background)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function ChatWorkspacesExample() {
  return (
    <Window>
      <ChatWorkspaces />
    </Window>
  )
}
