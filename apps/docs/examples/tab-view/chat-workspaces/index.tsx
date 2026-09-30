import { useState, type CSSProperties, type ReactNode } from 'react'
import { TabView, TabViewAction, TabViewBar, TabViewFooter, TabViewIndicator, TabViewList, TabViewSeparator, TabViewTab } from '@/components/ui/tab-view'
import { Icon } from '@/lib/icon'
import { themeScopeProps, useAppearance } from '@/lib/theme'

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

// Discord's tile: a circle at rest that morphs to a rounded square when its
// tab is hovered or selected (filling with the workspace color), with a
// mention badge. It reads the tab's state through `group-data-*`.
function WorkspaceTile({
  color = 'var(--primary)',
  mentions,
  children,
}: {
  color?: string
  mentions?: number
  children: ReactNode
}) {
  return (
    <span
      style={{ '--tile': color } as CSSProperties}
      className="relative box-border grid size-[34px] shrink-0 place-items-center rounded-[17px] border-2 border-transparent bg-secondary-strong font-sans text-[14px] leading-[normal] font-extrabold text-secondary-foreground [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),border-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] group-data-hovered:rounded-[11px] group-data-selected:rounded-[11px] group-data-selected:border-(--tile) group-data-selected:bg-(--tile) group-data-selected:text-white group-data-pressed:scale-[.94] motion-reduce:transition-none group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-link"
    >
      {children}
      {mentions ? (
        <span className="absolute -right-[7px] -bottom-[6px] box-border flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[3px] border-muted bg-destructive px-[3px] font-sans text-[10px] leading-none font-bold text-white">
          {mentions > 99 ? '99+' : mentions}
        </span>
      ) : null}
    </span>
  )
}

// A Discord server rail: a vertical TabView with a `workspace` bar. Home is
// the first tab, over a separator; Add is an action, not a tab.
function ServerRail({
  server,
  setServer,
  homeMentions,
}: {
  server: string
  setServer: (id: string) => void
  homeMentions?: number
}) {
  return (
    <TabView
      orientation="vertical"
      selectedKey={server}
      onSelectionChange={(k) => setServer(String(k))}
      className="contents"
    >
      <TabViewBar variant="workspace">
        <TabViewList aria-label="Workspaces">
          <TabViewTab id="home" textValue="Direct Messages">
            <TabViewIndicator variant="pill" />
            <WorkspaceTile mentions={homeMentions}>
              <Icon name="bubble-oval" size={17} sw={2} />
            </WorkspaceTile>
          </TabViewTab>
          <TabViewSeparator />
          {servers.map((s) => (
            <TabViewTab key={s.id} id={s.id} textValue={s.title}>
              <TabViewIndicator variant="pill" attention={s.unread} />
              <WorkspaceTile color={s.color} mentions={s.mentions}>
                {s.label}
              </WorkspaceTile>
            </TabViewTab>
          ))}
        </TabViewList>
        <TabViewFooter>
          <TabViewAction aria-label="Add workspace" icon="plus" />
        </TabViewFooter>
      </TabViewBar>
    </TabView>
  )
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
      <ServerRail server={server} setServer={setServer} homeMentions={1} />
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
