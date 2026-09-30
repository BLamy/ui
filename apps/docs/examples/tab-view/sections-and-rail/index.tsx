import { useState, type CSSProperties, type ReactNode } from 'react'
import { TabView, TabViewAction, TabViewBar, TabViewFooter, TabViewIndicator, TabViewList, TabViewPanel, TabViewPanels, TabViewSeparator, TabViewTab } from '@/components/ui/tab-view'
import { Icon } from '@/lib/icon'
import { themeScopeProps, useAppearance } from '@/lib/theme'

const items = [
  { id: 'contacts', icon: 'person', title: 'Contacts' },
  { id: 'recents', icon: 'clock', title: 'Recents' },
  { id: 'settings', icon: 'sliders', title: 'Settings' },
]
const blurb: Record<string, string> = {
  contacts: 'Each tab keeps its own stack — pushes slide under this bar.',
  recents: 'Tab state survives switching away and back.',
  settings: 'Arrow keys move between tabs.',
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
      className="relative box-border grid size-[34px] shrink-0 place-items-center rounded-[17px] border-2 border-transparent bg-secondary-strong font-ios text-[14px] leading-[normal] font-extrabold text-secondary-foreground [transition:border-radius_var(--duration-spring-bouncy)_var(--ease-spring-bouncy),background-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),border-color_var(--duration-spring-snappy)_var(--ease-spring-snappy),color_var(--duration-spring-snappy)_var(--ease-spring-snappy),scale_var(--duration-spring-snappy)_var(--ease-spring-snappy)] group-data-hovered:rounded-[11px] group-data-selected:rounded-[11px] group-data-selected:border-(--tile) group-data-selected:bg-(--tile) group-data-selected:text-white group-data-pressed:scale-[.94] motion-reduce:transition-none group-data-focus-visible:outline-2 group-data-focus-visible:outline-offset-2 group-data-focus-visible:outline-link"
    >
      {children}
      {mentions ? (
        <span className="absolute -right-[7px] -bottom-[6px] box-border flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-[3px] border-muted bg-destructive px-[3px] font-ios text-[10px] leading-none font-bold text-white">
          {mentions > 99 ? '99+' : mentions}
        </span>
      ) : null}
    </span>
  )
}

// The rail: a vertical TabView with a `workspace` bar. Home is
// the first tab, over a separator; Add is an action, not a tab.
function Rail({
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

// A Discord server rail beside the selected server's name.
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
      <Rail server={server} setServer={setServer} homeMentions={2} />
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
        A vertical TabView with a workspace bar: tiles are tabs (Up/Down
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
