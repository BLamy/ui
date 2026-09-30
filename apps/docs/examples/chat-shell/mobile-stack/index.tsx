import type { ReactNode } from 'react'
import { Avatar, Composer, ComposerCard, ComposerFooter, ComposerInput, ComposerSend, ComposerSpacer, Icon, SidebarContent, SidebarHeader, SidebarItem, SidebarSection, SplitView, SplitViewDetail, SplitViewSidebar, useSplitView } from '@brett_lamy/ui'
import { ChatShell, ChatShellBack, ChatShellFooter, ChatShellHeader, ChatShellHeaderIcon, ChatShellMain, ChatShellSidebar, ChatShellTitle } from '@/components/blocks/discord-clone/components/chat-shell'

const rooms = [
  { id: 'general', name: 'general', last: 'Morning! Docs are up.' },
  {
    id: 'design',
    name: 'design',
    last: 'Credenza morph is buttery now.',
    unread: true,
  },
  { id: 'random', name: 'random', last: '🍕 Friday?' },
]

const miles = { f: 'Miles', l: 'Okafor' }

function Rooms() {
  const { selection, select, collapsed } = useSplitView()
  return (
    <ChatShellSidebar className="w-full border-r-0">
      <SidebarHeader>
        <div className="px-[9px] font-ios text-[14px] font-bold text-foreground">
          Motion Lab
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSection title="Channels">
          {rooms.map((r) => (
            <SidebarItem
              key={r.id}
              icon={<Icon name="number" size={13} sw={2} />}
              label={r.name}
              // Collapsed, the rows are navigation: nothing stays selected.
              active={!collapsed && selection.sidebar === r.id}
              badge={r.unread ? 'new' : undefined}
              onPress={() => select('sidebar', r.id)}
            />
          ))}
        </SidebarSection>
      </SidebarContent>
    </ChatShellSidebar>
  )
}

function Room() {
  const { selection, collapsed, back } = useSplitView()
  const room = rooms.find((r) => r.id === selection.sidebar) ?? rooms[0]
  return (
    <ChatShellMain>
      <ChatShellHeader>
        {collapsed && <ChatShellBack onPress={back}>Channels</ChatShellBack>}
        <ChatShellHeaderIcon />
        <ChatShellTitle>{room.name}</ChatShellTitle>
      </ChatShellHeader>
      <div
        key={room.id}
        role="log"
        aria-live="polite"
        className="min-h-0 flex-1 overflow-y-auto py-3"
      >
        <div className="px-4 pb-2 text-center text-[11px] font-semibold text-tertiary-foreground">
          Today
        </div>
        <div className="flex gap-3 px-4 py-1.5">
          <Avatar c={miles} size={32} />
          <div className="min-w-0 flex-1 text-[13.5px] leading-normal text-foreground">
            <div className="flex items-baseline gap-2">
              <span className="font-semibold">{miles.f}</span>
              <span className="text-[11px] text-tertiary-foreground">
                9:41 AM
              </span>
            </div>
            <p className="m-0">{room.last}</p>
            <p className="m-0">Swipe from the left edge to go back.</p>
          </div>
        </div>
      </div>
      <ChatShellFooter>
        <Composer>
          <ComposerCard>
            <ComposerInput placeholder={'Message #' + room.name} />
            <ComposerFooter>
              <ComposerSpacer />
              <ComposerSend />
            </ComposerFooter>
          </ComposerCard>
        </Composer>
      </ChatShellFooter>
    </ChatShellMain>
  )
}

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

// A phone stack from SplitView: compact shows one column at a time — pick a
// channel to push the conversation, back / edge-swipe / Esc to pop. Wider, the
// same two columns tile.
export default function MobileStack({
  variant = 'phone',
}: {
  variant?: string
}) {
  return (
    <Window width={variant === 'phone' ? 390 : undefined}>
      <div style={{ height: 540, display: 'flex' }}>
        {/* remount on switch so each width starts from its default column */}
        <ChatShell key={variant}>
          <SplitView
            defaultSelection={{ sidebar: 'design' }}
            defaultCompactColumn="sidebar"
            className="bg-background"
          >
            <SplitViewSidebar width={240} className="bg-sidebar">
              <Rooms />
            </SplitViewSidebar>
            <SplitViewDetail className="bg-background">
              <Room />
            </SplitViewDetail>
          </SplitView>
        </ChatShell>
      </div>
    </Window>
  )
}
