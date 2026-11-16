import { useState } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarItem,
  SidebarProvider,
  SidebarSection,
  SidebarTrigger,
  SidebarAccount,
} from '@/components/ui/sidebar'

const pages = [
  { icon: 'tray', title: 'Inbox', trailing: 6 },
  { icon: 'bolt', title: 'Agent tasks', trailing: 2 },
  { icon: 'bell', title: 'Alerts' },
]

// This 380px frame is narrower than the provider's `breakpoints.medium`, so the
// provider is compact and `presentation="auto"` shows the sidebar as a drawer
// behind the trigger, with 44px rows. A press on a row closes the drawer by
// itself; Escape, the scrim and a swipe toward the edge close it too.
export default function NarrowContainer() {
  const [page, setPage] = useState('Inbox')
  return (
    <div className="p-4">
      <div className="mx-auto h-[440px] max-w-[380px] overflow-hidden rounded-card shadow-hairline">
        <SidebarProvider breakpoints={{ medium: 560 }}>
          <Sidebar width={260}>
            <SidebarHeader>
              <SidebarAccount title="Creamery Ops" description="Production" />
            </SidebarHeader>
            <SidebarContent aria-label="Creamery Ops">
              <SidebarItem icon="plus" title="New task" tint="var(--primary)" />
              <SidebarSection title="Workspace">
                {pages.map((p) => (
                  <SidebarItem
                    key={p.title}
                    icon={p.icon}
                    title={p.title}
                    trailing={p.trailing}
                    current={page === p.title}
                    onClick={() => setPage(p.title)}
                  />
                ))}
              </SidebarSection>
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <header className="flex items-center gap-1 border-b border-border px-1 py-0.5">
              <SidebarTrigger />
              <strong className="text-subhead text-foreground">{page}</strong>
            </header>
            <p className="m-0 p-4 text-footnote leading-relaxed text-muted-foreground">
              Open the sidebar with the button, then pick a page.
            </p>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  )
}
