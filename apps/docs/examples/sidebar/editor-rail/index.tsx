import { useState } from 'react'
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarInset,
  SidebarItem,
  SidebarProvider,
  SidebarSearch,
  SidebarSection,
  SidebarTrigger,
  SidebarWorkspace,
} from '@/components/ui/sidebar'
import { ThemeScope } from '@/lib/theme'

const panels = [
  { icon: 'doc', title: 'Explorer' },
  { icon: 'branch', title: 'Source control', trailing: 3 },
  { icon: 'play', title: 'Run and debug' },
  { icon: 'cube', title: 'Extensions' },
]

// `variant="rail"` with `defaultOpen={false}`: closed, the same rows are cut to
// their icons (each keeps its name, and a tooltip shows it on hover), section
// labels turn into hairlines, and the trigger (or ⌘B / Ctrl+B) expands it.
// In a `workbench` theme scope it wears the Workbench palette.
export default function CollapsibleRail() {
  const [panel, setPanel] = useState('Explorer')
  return (
    <ThemeScope scope="workbench" className="p-4">
      <div className="mx-auto h-[360px] overflow-hidden rounded-card shadow-hairline">
        <SidebarProvider defaultOpen={false} breakpoint={420}>
          <Sidebar variant="rail" width={220} railWidth={52}>
            <SidebarHeader>
              <SidebarWorkspace title="bl-ui" description="main · 3 changes" />
            </SidebarHeader>
            <SidebarContent aria-label="Editor">
              <SidebarSearch />
              <SidebarSection title="Workspace">
                {panels.map((p) => (
                  <SidebarItem
                    key={p.title}
                    icon={p.icon}
                    title={p.title}
                    trailing={p.trailing}
                    current={panel === p.title}
                    onClick={() => setPanel(p.title)}
                  />
                ))}
              </SidebarSection>
            </SidebarContent>
          </Sidebar>
          <SidebarInset>
            <header className="flex items-center gap-2 border-b border-border px-2 py-1.5">
              <SidebarTrigger shortcut="mod+b" />
              <strong className="text-footnote text-foreground">{panel}</strong>
            </header>
            <pre className="m-0 p-4 font-mono text-caption leading-relaxed text-muted-foreground">
              {'export function App() {\n  return <Sidebar variant="rail" />\n}'}
            </pre>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </ThemeScope>
  )
}
