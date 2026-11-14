import { useState } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarInset,
  SidebarItem,
  SidebarProvider,
  SidebarSection,
  SidebarTrigger,
} from '@/components/ui/sidebar'

const guides = ['Introduction', 'Installation', 'Theming']
const components = ['Button', 'List', 'NavigationStack', 'Sidebar', 'Tabs']

// `variant="float"`: the sidebar is an inset card with its own border and
// radius, which suits documentation and settings. Rows render as links with
// `render`; `current` marks the page that shows (aria-current="page").
export default function FloatingDocs() {
  const [page, setPage] = useState('Sidebar')
  const link = (title: string, icon: string) => (
    <SidebarItem
      key={title}
      icon={icon}
      title={title}
      current={page === title}
      render={<a href={`#${title.toLowerCase()}`} />}
      onClick={(event) => {
        event.preventDefault()
        setPage(title)
      }}
    />
  )
  return (
    <div className="p-4">
      <div className="mx-auto h-[400px] overflow-hidden rounded-card shadow-hairline">
        <SidebarProvider breakpoint={520}>
          <Sidebar variant="float" width={232}>
            <SidebarContent aria-label="Documentation" className="pt-2">
              <SidebarSection title="Getting started">
                {guides.map((g) => link(g, 'doc'))}
              </SidebarSection>
              <SidebarSection title="Components">
                {components.map((c) => link(c, 'cube'))}
              </SidebarSection>
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <article className="px-5 py-4">
              <SidebarTrigger className="-ms-2" />
              <h2 className="mt-2 mb-1.5 text-title font-semibold text-foreground">{page}</h2>
              <p className="m-0 text-footnote leading-relaxed text-muted-foreground">
                The floating card reads as its own surface beside the page.
              </p>
            </article>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  )
}
