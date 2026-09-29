import { useState, type ReactNode } from 'react'
import {
  Sidebar,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  WorkbenchTheme,
} from '@brett_lamy/ui'

function EditorRail() {
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
      {/* rail: closed collapses to icons (with tooltips) instead of sliding
          away */}
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
            <strong style={{ fontSize: 13.5, color: 'var(--wb-label)' }}>
              {panel}
            </strong>
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

function CollapsibleRail() {
  return (
    <Window>
      <EditorRail />
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
        boxShadow: '0 0 0 1px var(--wb-sep)',
      }}
    >
      {children}
    </div>
  )
}

// Workbench parts read the --wb-* tokens WorkbenchTheme sets; it follows the
// app's light / dark appearance.
export default function CollapsibleRailExample() {
  return (
    <WorkbenchTheme style={{ padding: 18 }}>
      <CollapsibleRail />
    </WorkbenchTheme>
  )
}
