import { type ReactNode } from 'react'
import { Tabs, TabsBar, TabsList, TabsPanel, TabsPanels, TabsSeparator, TabsTab } from '@/components/ui/tabs'

function EditorInspector() {
  return (
    <div style={{ display: 'flex', height: 360, background: 'var(--background)' }}>
      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: 24,
          background: 'var(--muted)',
        }}
      >
        <div
          style={{
            height: '100%',
            borderRadius: 12,
            background: 'var(--card)',
            boxShadow: '0 0 0 1px var(--border)',
            display: 'grid',
            placeItems: 'center',
            color: 'var(--muted-foreground)',
          }}
        >
          Canvas
        </div>
      </main>
      {/* side="end": the rail sits on the trailing edge, panels open
          beside it */}
      <Tabs
        variant="rail"
        side="end"
        defaultValue="info"
        style={{ width: 300, borderLeft: '1px solid var(--border)' }}
      >
        <TabsBar style={{ width: 56 }}>
          <TabsList aria-label="Inspector">
            <TabsTab value="info" icon="info" aria-label="Info" />
            <TabsTab value="comments" icon="message" aria-label="Comments" />
            <TabsSeparator />
            <TabsTab value="history" icon="clock" aria-label="History" />
          </TabsList>
        </TabsBar>
        <TabsPanels>
          <TabsPanel value="info" style={{ padding: 16, fontSize: 13.5 }}>
            <strong>Frame 12</strong>
            <p style={{ color: 'var(--muted-foreground)' }}>390 × 844 · Auto layout</p>
          </TabsPanel>
          <TabsPanel value="comments" style={{ padding: 16, fontSize: 13.5 }}>
            <strong>2 comments</strong>
            <p style={{ color: 'var(--muted-foreground)' }}>
              “Tighten the header spacing.”
            </p>
          </TabsPanel>
          <TabsPanel value="history" style={{ padding: 16, fontSize: 13.5 }}>
            <strong>Version history</strong>
            <p style={{ color: 'var(--muted-foreground)' }}>Autosaved 2 minutes ago</p>
          </TabsPanel>
        </TabsPanels>
      </Tabs>
    </div>
  )
}

/** The rounded, hairline-bordered window the example sits in. */
function Window({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        margin: '0 auto',
        borderRadius: 14,
        overflow: 'hidden',
        background: 'var(--background)',
        color: 'var(--foreground)',
        boxShadow: '0 0 0 1px var(--border), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

export default function EditorInspectorExample() {
  return (
    <Window>
      <EditorInspector />
    </Window>
  )
}
