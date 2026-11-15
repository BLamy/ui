import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarItem,
  SidebarProvider,
  SidebarSearch,
  SidebarSection,
  SidebarTrigger,
  SidebarAccount,
} from '@/components/ui/sidebar'

const pipeline = [
  { icon: 'house', title: 'Overview' },
  { icon: 'briefcase', title: 'Deals', trailing: 3 },
  { icon: 'person-bust', title: 'Contacts' },
  { icon: 'calendar', title: 'Meetings' },
]
const reports = [
  { icon: 'chart-bar', title: 'Forecast' },
  { icon: 'globe', title: 'Regions' },
]

// A CRM: the workspace in the header, a search with its shortcut, two sections
// with a count, and the signed-in account in the footer. Rows take an Icon name
// or any node (the Avatar); a number in `trailing` is drawn as a count badge.
export default function DockedCrm() {
  const [page, setPage] = useState('Deals')
  const row = (p: { icon: string; title: string; trailing?: number }) => (
    <SidebarItem
      key={p.title}
      icon={p.icon}
      title={p.title}
      trailing={p.trailing}
      current={page === p.title}
      onClick={() => setPage(p.title)}
    />
  )
  return (
    <div className="p-4">
      <div className="mx-auto h-[400px] overflow-hidden rounded-card shadow-hairline">
        <SidebarProvider breakpoint={520}>
          <Sidebar width={220}>
            <SidebarHeader>
              <SidebarAccount title="Northwind" description="Sales · Pro plan" />
            </SidebarHeader>
            <SidebarContent aria-label="Northwind">
              <SidebarSearch placeholder="Search deals" shortcut="/" />
              <SidebarSection title="Pipeline">{pipeline.map(row)}</SidebarSection>
              <SidebarSection title="Reports">{reports.map(row)}</SidebarSection>
            </SidebarContent>
            <SidebarFooter>
              <SidebarItem
                icon={<Avatar name="Ada Lovelace" size={20} />}
                title="Ada Lovelace"
                description="ada@northwind.dev"
              />
            </SidebarFooter>
          </Sidebar>
          <SidebarInset>
            <header className="flex items-center gap-2 border-b border-border px-2 py-1.5">
              <SidebarTrigger />
              <strong className="text-subhead text-foreground">{page}</strong>
            </header>
            <p className="m-0 p-4 text-footnote text-muted-foreground">
              Press / to focus the search button, or pick a page.
            </p>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  )
}
