/* Sidebar page examples (Workbench --wb-* tokens). Each `// #region` is shown verbatim as the example's code. */
import { useState, type ReactNode } from 'react'
import {
  Avatar,
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from '@brett_lamy/ui'
import raw from './sidebar.tsx?raw'
import { examples } from './chrome'

/* Docs chrome for the Workbench-token examples: a rounded, bordered window. */
function WbWindow({ width, children }: { width?: number; children?: ReactNode }) {
  return (
    <div
      style={{
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--wb-sep)',
      }}
    >
      {children}
    </div>
  )
}

// #region sidebar_docked
const deals = [
  { name: 'Northwind renewal', stage: 'Negotiation', value: '$48k' },
  { name: 'Acme expansion', stage: 'Proposal', value: '$120k' },
  { name: 'Globex pilot', stage: 'Discovery', value: '$18k' },
]

export function CrmSidebar() {
  const [page, setPage] = useState('Deals')
  const item = (icon: string, label: string, badge?: number) => (
    <Sidebar.Item
      icon={icon}
      label={label}
      badge={badge}
      active={page === label}
      onPress={() => setPage(label)}
    />
  )
  return (
    <div style={{ height: 380 }}>
      <SidebarProvider breakpoint={520}>
        <Sidebar variant="docked" width={220}>
          <Sidebar.Header>
            <Sidebar.Workspace name="Northwind" detail="Sales · Pro plan" />
          </Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Search placeholder="Search deals" />
            <Sidebar.Section title="Pipeline">
              {item('home', 'Overview')}
              {item('box', 'Deals', 3)}
              {item('user', 'Contacts')}
              {item('cal', 'Meetings')}
            </Sidebar.Section>
            <Sidebar.Section title="Reports">
              {item('doc', 'Forecast')}
              {item('globe', 'Regions')}
            </Sidebar.Section>
          </Sidebar.Content>
          <Sidebar.Footer>
            <Sidebar.Item
              icon={<Avatar c={{ f: 'Ada', l: 'Lovelace' }} size={20} />}
              label="Ada Lovelace"
            />
          </Sidebar.Footer>
        </Sidebar>
        <SidebarInset>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              borderBottom: '1px solid var(--wb-sep)',
            }}
          >
            <SidebarTrigger />
            <strong style={{ fontSize: 14, color: 'var(--wb-label)' }}>{page}</strong>
          </header>
          <div style={{ padding: 12 }}>
            {deals.map((d) => (
              <div
                key={d.name}
                style={{
                  display: 'flex',
                  padding: '10px 6px',
                  fontSize: 13,
                  borderBottom: '1px solid var(--wb-sep)',
                  color: 'var(--wb-label)',
                }}
              >
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ width: 110, color: 'var(--wb-label2)' }}>{d.stage}</span>
                <strong>{d.value}</strong>
              </div>
            ))}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
// #endregion

// #region sidebar_rail
export function EditorRail() {
  const [panel, setPanel] = useState('Explorer')
  const item = (icon: string, label: string, badge?: number) => (
    <Sidebar.Item
      icon={icon}
      label={label}
      badge={badge}
      active={panel === label}
      onPress={() => setPanel(label)}
    />
  )
  return (
    <div style={{ height: 340 }}>
      {/* rail: closed collapses to icons (with tooltips) instead of sliding away */}
      <SidebarProvider defaultOpen={false} breakpoint={420}>
        <Sidebar variant="rail" width={210} railWidth={52}>
          <Sidebar.Header>
            <Sidebar.Workspace name="bl-ui" detail="main · 3 changes" />
          </Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Search />
            <Sidebar.Section title="Workspace">
              {item('doc', 'Explorer')}
              {item('code', 'Source control', 3)}
              {item('bolt', 'Run and debug')}
              {item('box', 'Extensions')}
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
        <SidebarInset>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              borderBottom: '1px solid var(--wb-sep)',
            }}
          >
            <SidebarTrigger />
            <strong style={{ fontSize: 13.5, color: 'var(--wb-label)' }}>{panel}</strong>
          </header>
          <pre
            style={{
              margin: 0,
              padding: 16,
              fontSize: 12.5,
              lineHeight: 1.6,
              color: 'var(--wb-label2)',
            }}
          >
            {'export function App() {\n  return <Sidebar variant="rail" />\n}'}
          </pre>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
// #endregion

// #region sidebar_float
const guides = ['Introduction', 'Installation', 'Theming']
const components = ['Button', 'List', 'NavigationStack', 'Sidebar', 'TabView']

export function DocsSidebar() {
  const [page, setPage] = useState('Sidebar')
  return (
    <div style={{ height: 380 }}>
      {/* float: an inset card with its own border and radius */}
      <SidebarProvider breakpoint={520}>
        <Sidebar variant="float" width={230}>
          <Sidebar.Content>
            <Sidebar.Section title="Getting started">
              {guides.map((g) => (
                <Sidebar.Item
                  key={g}
                  icon="doc"
                  label={g}
                  active={page === g}
                  onPress={() => setPage(g)}
                />
              ))}
            </Sidebar.Section>
            <Sidebar.Section title="Components">
              {components.map((c) => (
                <Sidebar.Item
                  key={c}
                  icon="box"
                  label={c}
                  active={page === c}
                  onPress={() => setPage(c)}
                />
              ))}
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
        <SidebarInset>
          <article style={{ padding: '18px 22px', color: 'var(--wb-label)' }}>
            <SidebarTrigger style={{ marginLeft: -6 }} />
            <h2 style={{ margin: '8px 0 6px', fontSize: 22 }}>{page}</h2>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.6,
                color: 'var(--wb-label2)',
              }}
            >
              The floating card suits documentation and settings, where the sidebar reads as
              its own surface.
            </p>
          </article>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
// #endregion

// #region sidebar_mobile
interface MenuItemProps {
  icon: string
  label: string
  badge?: number
  page: string
  onPick: (label: string) => void
}

/** Any child can read the provider: close the drawer after a pick when it is an overlay. */
function MenuItem({ icon, label, badge, page, onPick }: MenuItemProps) {
  const { narrow, setOpen } = useSidebar()
  return (
    <Sidebar.Item
      icon={icon}
      label={label}
      badge={badge}
      active={page === label}
      onPress={() => {
        onPick(label)
        if (narrow) setOpen(false)
      }}
    />
  )
}

export function MobileMenu() {
  const [page, setPage] = useState('Inbox')
  return (
    <div style={{ height: 400 }}>
      {/* Below the breakpoint every variant becomes an overlay drawer behind the hamburger */}
      <SidebarProvider breakpoint={560}>
        <Sidebar variant="docked" width={250}>
          <Sidebar.Header>
            <Sidebar.Workspace name="Creamery Ops" detail="Production" />
          </Sidebar.Header>
          <Sidebar.Content>
            <Sidebar.Item icon="plus" label="New task" tone="#0A84FF" />
            <Sidebar.Section title="Workspace">
              <MenuItem icon="inbox" label="Inbox" badge={6} page={page} onPick={setPage} />
              <MenuItem
                icon="bolt"
                label="Agent tasks"
                badge={2}
                page={page}
                onPick={setPage}
              />
              <MenuItem icon="bell" label="Alerts" page={page} onPick={setPage} />
            </Sidebar.Section>
          </Sidebar.Content>
        </Sidebar>
        <SidebarInset>
          <header
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '9px 12px',
              borderBottom: '1px solid var(--wb-sep)',
            }}
          >
            <SidebarTrigger />
            <strong style={{ fontSize: 14, color: 'var(--wb-label)' }}>{page}</strong>
          </header>
          <p
            style={{
              padding: '4px 16px',
              fontSize: 13.5,
              lineHeight: 1.6,
              color: 'var(--wb-label2)',
            }}
          >
            This pane is narrower than the breakpoint, so the docked sidebar lives behind
            the hamburger. Picking an item closes it.
          </p>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}
// #endregion

export const SIDEBAR_LIVE = examples(raw, [
  {
    id: 'sidebar_docked',
    title: 'Docked · CRM with a footer account',
    theme: 'wb',
    h: 400,
    Render: () => (
      <WbWindow>
        <CrmSidebar />
      </WbWindow>
    ),
  },
  {
    id: 'sidebar_rail',
    title: 'Collapsible icon rail',
    theme: 'wb',
    h: 360,
    Render: () => (
      <WbWindow>
        <EditorRail />
      </WbWindow>
    ),
  },
  {
    id: 'sidebar_float',
    title: 'Floating card · documentation',
    theme: 'wb',
    h: 400,
    Render: () => (
      <WbWindow>
        <DocsSidebar />
      </WbWindow>
    ),
  },
  {
    id: 'sidebar_mobile',
    title: 'Narrow container · hamburger overlay',
    theme: 'wb',
    h: 420,
    Render: () => (
      <WbWindow width={380}>
        <MobileMenu />
      </WbWindow>
    ),
  },
])
