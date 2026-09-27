import type { ReactNode } from 'react'
import {
  ChannelGroup,
  ChannelItem,
  ChannelList,
  ChatComposer,
  ChatShell,
  ChatShellBack,
  ChatShellFooter,
  ChatShellHeader,
  ChatShellHeaderIcon,
  ChatShellMain,
  ChatShellSidebar,
  ChatShellTitle,
  DateDivider,
  Message,
  MessageAuthor,
  MessageAvatar,
  MessageBody,
  MessageContent,
  MessageGroup,
  MessageHeader,
  MessageList,
  MessageTimestamp,
  ServerHeader,
  SplitView,
  SplitViewDetail,
  SplitViewSidebar,
  useSplitView,
} from '@brett_lamy/ui'

const rooms = [
  { id: 'general', name: 'general', last: 'Morning! Docs are up.' },
  { id: 'design', name: 'design', last: 'Credenza morph is buttery now.', unread: true },
  { id: 'random', name: 'random', last: '🍕 Friday?' },
]

function Rooms() {
  const { selection, select, collapsed } = useSplitView()
  return (
    <ChatShellSidebar className="w-full border-r-0">
      <ServerHeader action={null}>Motion Lab</ServerHeader>
      <ChannelList
        // Collapsed, the rows are navigation: nothing stays selected.
        selectedKey={collapsed ? null : selection.sidebar}
        onSelectionChange={(id) => select('sidebar', id)}
      >
        <ChannelGroup label="Channels">
          {rooms.map((r) => (
            <ChannelItem key={r.id} id={r.id} unread={r.unread}>
              {r.name}
            </ChannelItem>
          ))}
        </ChannelGroup>
      </ChannelList>
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
      <MessageList scrollKey={room.id}>
        <DateDivider>Today</DateDivider>
        <MessageGroup>
          <Message user={{ name: 'Miles', c: '#BF5AF2', role: '#D8A9F0' }}>
            <MessageAvatar />
            <MessageBody>
              <MessageHeader>
                <MessageAuthor />
                <MessageTimestamp>9:41 AM</MessageTimestamp>
              </MessageHeader>
              <MessageContent>{room.last}</MessageContent>
            </MessageBody>
          </Message>
          <Message variant="continued">
            <MessageAvatar />
            <MessageBody>
              <MessageContent>Swipe from the left edge to go back.</MessageContent>
            </MessageBody>
          </Message>
        </MessageGroup>
      </MessageList>
      <ChatShellFooter>
        <ChatComposer placeholder={'Message #' + room.name} onSend={() => {}} />
      </ChatShellFooter>
    </ChatShellMain>
  )
}

// A rounded, hairline-bordered window with the page background; `width` caps it, centered.
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
        background: 'var(--bl-bg)',
        color: 'var(--bl-label)',
        boxShadow: '0 0 0 1px var(--bl-sep), 0 10px 30px rgba(0,0,0,.06)',
        isolation: 'isolate',
      }}
    >
      {children}
    </div>
  )
}

// A phone stack from SplitView: compact shows one column at a time — pick a channel to push the
// conversation, back / edge-swipe / Esc to pop. Wider, the same two columns tile.
export default function MobileStack({ variant = 'phone' }: { variant?: string }) {
  return (
    <Window width={variant === 'phone' ? 390 : undefined}>
      <div style={{ height: 540, display: 'flex' }}>
        {/* remount on switch so each width starts from its default column */}
        <ChatShell key={variant}>
          <SplitView defaultSelection={{ sidebar: 'design' }} defaultCompactColumn="sidebar" className="bg-ck-bg">
            <SplitViewSidebar width={240} className="bg-ck-side">
              <Rooms />
            </SplitViewSidebar>
            <SplitViewDetail className="bg-ck-bg">
              <Room />
            </SplitViewDetail>
          </SplitView>
        </ChatShell>
      </div>
    </Window>
  )
}
