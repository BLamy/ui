import { type ReactNode } from 'react'
import {
  TabView,
  TabViewBar,
  TabViewList,
  TabViewPanel,
  TabViewPanels,
  TabViewSeparator,
  TabViewTab,
} from '@brett_lamy/ui'

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
      {/* placement="end": the rail sits on the trailing edge, panels open
          beside it */}
      <TabView
        placement="end"
        defaultSelectedKey="info"
        style={{ width: 300, borderLeft: '1px solid var(--border)' }}
      >
        <TabViewBar style={{ width: 56 }}>
          <TabViewList aria-label="Inspector">
            <TabViewTab id="info" icon="info" textValue="Info" />
            <TabViewTab id="comments" icon="message" textValue="Comments" />
            <TabViewSeparator />
            <TabViewTab id="history" icon="clock" textValue="History" />
          </TabViewList>
        </TabViewBar>
        <TabViewPanels>
          <TabViewPanel id="info" style={{ padding: 16, fontSize: 13.5 }}>
            <strong>Frame 12</strong>
            <p style={{ color: 'var(--muted-foreground)' }}>390 × 844 · Auto layout</p>
          </TabViewPanel>
          <TabViewPanel id="comments" style={{ padding: 16, fontSize: 13.5 }}>
            <strong>2 comments</strong>
            <p style={{ color: 'var(--muted-foreground)' }}>
              “Tighten the header spacing.”
            </p>
          </TabViewPanel>
          <TabViewPanel id="history" style={{ padding: 16, fontSize: 13.5 }}>
            <strong>Version history</strong>
            <p style={{ color: 'var(--muted-foreground)' }}>Autosaved 2 minutes ago</p>
          </TabViewPanel>
        </TabViewPanels>
      </TabView>
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
