import { useState, type ReactNode } from 'react'
import {
  Avatar,
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  WorkbenchTheme,
} from '@brett_lamy/ui'

const deals = [
  { name: 'Northwind renewal', stage: 'Negotiation', value: '$48k' },
  { name: 'Acme expansion', stage: 'Proposal', value: '$120k' },
  { name: 'Globex pilot', stage: 'Discovery', value: '$18k' },
]

function CrmSidebar() {
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
              borderBottom: '1px solid var(--border)',
            }}
          >
            <SidebarTrigger />
            <strong style={{ fontSize: 14, color: 'var(--foreground)' }}>
              {page}
            </strong>
          </header>
          <div style={{ padding: 12 }}>
            {deals.map((d) => (
              <div
                key={d.name}
                style={{
                  display: 'flex',
                  padding: '10px 6px',
                  fontSize: 13,
                  borderBottom: '1px solid var(--border)',
                  color: 'var(--foreground)',
                }}
              >
                <span style={{ flex: 1 }}>{d.name}</span>
                <span style={{ width: 110, color: 'var(--muted-foreground)' }}>
                  {d.stage}
                </span>
                <strong>{d.value}</strong>
              </div>
            ))}
          </div>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

function DockedCrm() {
  return (
    <Window>
      <CrmSidebar />
    </Window>
  )
}

/**
 * A rounded window with a hairline border; `width` caps it (phone-sized
 * examples), centered.
 */
function Window({ width, children }: { width?: number; children?: ReactNode }) {
  return (
    <div
      style={{
        maxWidth: width,
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 0 0 1px var(--border)',
      }}
    >
      {children}
    </div>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the
// app's light / dark appearance.
export default function DockedCrmExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <DockedCrm />
    </WorkbenchTheme>
  )
}
