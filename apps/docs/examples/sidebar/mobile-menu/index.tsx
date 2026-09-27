import { useState, type ReactNode } from 'react'
import { Sidebar, SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from '@brett_lamy/ui'

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

function MobileMenu() {
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

export default function NarrowHamburger() {
  return (
    <Window width={380}>
      <MobileMenu />
    </Window>
  )
}

/** A rounded window with a hairline border; `width` caps it (phone-sized examples), centered. */
function Window({ width, children }: { width?: number; children?: ReactNode }) {
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
