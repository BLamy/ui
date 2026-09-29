import { useState, type ReactNode } from 'react'
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  WorkbenchTheme,
} from '@brett_lamy/ui'

const guides = ['Introduction', 'Installation', 'Theming']
const components = ['Button', 'List', 'NavigationStack', 'Sidebar', 'TabView']

function DocsSidebar() {
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
          <article style={{ padding: '18px 22px', color: 'var(--foreground)' }}>
            <SidebarTrigger style={{ marginLeft: -6 }} />
            <h2 style={{ margin: '8px 0 6px', fontSize: 22 }}>{page}</h2>
            <p
              style={{
                margin: 0,
                fontSize: 13.5,
                lineHeight: 1.6,
                color: 'var(--muted-foreground)',
              }}
            >
              The floating card suits documentation and settings, where the
              sidebar reads as its own surface.
            </p>
          </article>
        </SidebarInset>
      </SidebarProvider>
    </div>
  )
}

function FloatingDocs() {
  return (
    <Window>
      <DocsSidebar />
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
export default function FloatingDocsExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <FloatingDocs />
    </WorkbenchTheme>
  )
}
