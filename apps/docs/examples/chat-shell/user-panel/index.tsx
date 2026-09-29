import type { ReactNode } from 'react'
import {
  Avatar,
  ChatShell,
  ChatShellHeaderAction,
  ChatShellSidebar,
  Icon,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarSection,
} from '@brett_lamy/ui'

const me = { f: 'Ada', l: 'Lovelace' }

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

// The foot of the sidebar: who you are, your presence, and quick actions —
// a SidebarFooter row of an Avatar, two lines of text and header actions.
export default function Me() {
  return (
    <Window width={260}>
      <ChatShell style={{ height: 240 }}>
        <ChatShellSidebar className="w-full border-r-0">
          <SidebarHeader>
            <div className="px-[9px] font-ios text-[14px] font-bold text-foreground">
              BL UI HQ
            </div>
          </SidebarHeader>
          <SidebarContent>
            <SidebarSection title="Channels">
              <SidebarItem
                icon={<Icon name="number" size={13} sw={2} />}
                label="general"
                active
              />
              <SidebarItem
                icon={<Icon name="number" size={13} sw={2} />}
                label="design"
              />
            </SidebarSection>
          </SidebarContent>
          <SidebarFooter>
            <div className="flex items-center gap-2 px-1">
              <Avatar c={me} size={28} />
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[13px] font-semibold text-foreground">
                  Ada Lovelace
                </div>
                <div className="text-[11px] text-muted-foreground">Online</div>
              </div>
              <ChatShellHeaderAction aria-label="Mute">
                <Icon name="mic" size={15} sw={1.9} />
              </ChatShellHeaderAction>
              <ChatShellHeaderAction aria-label="Settings">
                <Icon name="gearshape" size={15} sw={1.9} />
              </ChatShellHeaderAction>
            </div>
          </SidebarFooter>
        </ChatShellSidebar>
      </ChatShell>
    </Window>
  )
}
