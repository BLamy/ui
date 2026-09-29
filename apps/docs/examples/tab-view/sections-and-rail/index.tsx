import { useState, type ReactNode } from 'react'
import {
  themeScopeProps,
  Icon,
  TabView,
  TabViewBar,
  TabViewList,
  TabViewPanel,
  TabViewPanels,
  TabViewTab,
  useAppearance,
  WorkspaceRail,
  WorkspaceRailAction,
  WorkspaceRailHome,
  WorkspaceRailItem,
  WorkspaceRailList,
  WorkspaceRailSeparator,
} from '@brett_lamy/ui'

const items = [
  { id: 'contacts', icon: 'person', title: 'Contacts' },
  { id: 'recents', icon: 'clock', title: 'Recents' },
  { id: 'settings', icon: 'sliders', title: 'Settings' },
]
const blurb: Record<string, string> = {
  contacts: 'Each tab keeps its own stack — pushes slide under this bar.',
  recents: 'Tab state survives switching away and back.',
  settings: 'Every selection fires Haptics.selection().',
}
const servers = [
  { id: 'blui', label: 'T', color: '#0A84FF', title: 'BL UI HQ' },
  {
    id: 'creamery',
    label: 'C',
    color: '#BF5AF2',
    title: 'Creamery',
    unread: true,
  },
  { id: 'labs', label: 'L', color: '#32D74B', title: 'Labs', mentions: 4 },
  {
    id: 'ops',
    label: 'O',
    color: '#FF9F0A',
    title: 'Ops',
    unread: true,
    mentions: 12,
  },
]

/** A rounded, fixed-height frame the tab view fills. */
function Frame({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        height: 330,
        borderRadius: 12,
        overflow: 'hidden',
        background: 'var(--background)',
        boxShadow: 'inset 0 0 0 1px rgba(0,0,0,.05)',
      }}
    >
      {children}
    </div>
  )
}

function Panel({ id, horizontal }: { id: string; horizontal: boolean }) {
  const cur = items.find((i) => i.id === id)!
  return (
    // A horizontal bar floats at the bottom, so leave room for its 62px.
    <div
      style={{
        position: 'absolute',
        inset: horizontal ? '0 0 62px' : 0,
        display: 'grid',
        placeItems: 'center',
        padding: '0 28px',
        textAlign: 'center',
      }}
    >
      <div>
        <span
          style={{
            display: 'inline-grid',
            placeItems: 'center',
            width: 46,
            height: 46,
            borderRadius: 13,
            background: 'var(--secondary)',
            color: 'var(--primary)',
          }}
        >
          <Icon name={cur.icon} size={25} />
        </span>
        <div style={{ fontSize: 16.5, fontWeight: 650, marginTop: 10 }}>
          {cur.title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: 'var(--muted-foreground)',
            marginTop: 4,
            lineHeight: 1.5,
          }}
        >
          {blurb[id]}
        </div>
      </div>
    </div>
  )
}

// A Discord server rail: WorkspaceRail is a vertical TabView with custom tiles.
function ServerRail({
  server,
  setServer,
}: {
  server: string
  setServer: (id: string) => void
}) {
  const serverName =
    server === 'home'
      ? 'Direct Messages'
      : servers.find((s) => s.id === server)?.title
  // A chat theme scope that follows light / dark.
  const appearance = useAppearance() ?? 'light'
  return (
    <div
      {...themeScopeProps({ scope: 'chat', appearance })}
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        background: 'var(--background)',
        color: 'var(--foreground)',
      }}
    >
      <WorkspaceRail selectedKey={server} onSelectionChange={setServer}>
        <WorkspaceRailList>
          <WorkspaceRailHome mentions={2} />
          <WorkspaceRailSeparator />
          {servers.map((s) => (
            <WorkspaceRailItem key={s.id} {...s} />
          ))}
        </WorkspaceRailList>
        <WorkspaceRailAction />
      </WorkspaceRail>
      <div
        style={{
          padding: '22px 24px',
          fontSize: 13,
          lineHeight: 1.5,
          color: 'var(--muted-foreground)',
        }}
      >
        <div
          style={{
            fontSize: 16.5,
            fontWeight: 650,
            color: 'var(--foreground)',
            marginBottom: 4,
          }}
        >
          {serverName}
        </div>
        ChatKit's WorkspaceRail is a vertical TabView: tiles are tabs (Up/Down
        arrows), the pill marks unread / hover / selected, and Add is an action,
        not a tab.
      </div>
    </div>
  )
}

// orientation="horizontal": an iOS bar at the bottom. "vertical": a left rail.
export default function SectionsAndRail({
  variant = 'horizontal',
}: {
  variant?: string
}) {
  // Both selections live up here, so they survive switching variants.
  const [tab, setTab] = useState('contacts')
  const [server, setServer] = useState('blui')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Frame>
        {variant === 'discord' ? (
          <ServerRail server={server} setServer={setServer} />
        ) : (
          <TabView
            key={variant}
            orientation={variant === 'vertical' ? 'vertical' : 'horizontal'}
            selectedKey={tab}
            onSelectionChange={(k) => setTab(String(k))}
            style={{ position: 'absolute', inset: 0 }}
          >
            <TabViewBar>
              <TabViewList aria-label="Sections">
                {items.map((it) => (
                  <TabViewTab
                    key={it.id}
                    id={it.id}
                    icon={it.icon}
                    title={it.title}
                  />
                ))}
              </TabViewList>
            </TabViewBar>
            <TabViewPanels>
              {items.map((it) => (
                <TabViewPanel key={it.id} id={it.id}>
                  <Panel id={it.id} horizontal={variant !== 'vertical'} />
                </TabViewPanel>
              ))}
            </TabViewPanels>
          </TabView>
        )}
      </Frame>
    </div>
  )
}
