import type { ReactNode } from 'react'
import {
  ChatShell,
  WorkspaceRail,
  WorkspaceRailAction,
  WorkspaceRailHome,
  WorkspaceRailItem,
  WorkspaceRailList,
  WorkspaceRailSeparator,
} from '@brett_lamy/ui'

// A rounded, hairline-bordered window with the page background; `width` caps
// it, centered.
function Window({ width, children }: { width?: number; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: width,
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

// Hover a tile: it rounds from a circle to a squircle and the pill on its edge
// grows from the unread nub. Select one: the pill runs full height on a springy
// curve. Up / Down move between tiles.
export default function Rail() {
  return (
    <Window width={320}>
      <ChatShell style={{ height: 300 }}>
        <WorkspaceRail defaultSelectedKey="blui">
          <WorkspaceRailList>
            <WorkspaceRailHome unread />
            <WorkspaceRailSeparator />
            <WorkspaceRailItem
              id="blui"
              label="B"
              color="#0A84FF"
              title="BL UI HQ"
            />
            <WorkspaceRailItem
              id="creamery"
              label="C"
              color="#BF5AF2"
              title="Creamery"
              unread
            />
            <WorkspaceRailItem
              id="lab"
              label="L"
              color="#30D158"
              title="Motion Lab"
              mentions={3}
            />
          </WorkspaceRailList>
          <WorkspaceRailAction aria-label="Add workspace" />
        </WorkspaceRail>
        <div
          style={{
            flex: 1,
            padding: 18,
            fontSize: 13,
            lineHeight: 1.5,
            color: 'var(--muted-foreground)',
          }}
        >
          Hover and select the tiles: corners and the pill spring between
          states.
        </div>
      </ChatShell>
    </Window>
  )
}
