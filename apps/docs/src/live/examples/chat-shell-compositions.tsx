/* ChatShell page examples: the same primitives composed into several chat layouts. Each `// #region` is shown
   verbatim as the example's code; the full Discord layout shows the registry block's own source. */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import {
  ChannelGroup,
  ChannelItem,
  ChannelList,
  ChatAvatar,
  ChatComposer,
  ChatIcon,
  chatIconPaths,
  ChatShell,
  ChatShellBack,
  ChatShellDescription,
  ChatShellFooter,
  ChatShellHeader,
  ChatShellHeaderAction,
  ChatShellHeaderActions,
  ChatShellHeaderIcon,
  ChatShellMain,
  ChatShellNav,
  ChatShellNavTrigger,
  ChatShellPanel,
  ChatShellSidebar,
  ChatShellTitle,
  ChatUsersProvider,
  DateDivider,
  Message,
  MessageAction,
  MessageActions,
  MessageAuthor,
  MessageAvatar,
  MessageBadge,
  MessageBody,
  MessageContent,
  MessageDivider,
  MessageGroup,
  MessageHeader,
  MessageList,
  MessageTimestamp,
  ServerHeader,
  SplitView,
  SplitViewDetail,
  SplitViewSidebar,
  ThreadHeader,
  ThreadPreview,
  ThreadPreviewReply,
  TypingIndicator,
  UserPanel,
  UserPanelInfo,
  UserPanelName,
  UserPanelStatus,
  useSplitView,
  WorkspaceRail,
  WorkspaceRailAction,
  WorkspaceRailHome,
  WorkspaceRailItem,
  WorkspaceRailList,
  WorkspaceRailSeparator,
  type ChatUser,
} from '@brett_lamy/ui'
import DiscordClone from '@brett_lamy/registry/blocks/discord-clone/page'
import blockSource from '@brett_lamy/registry/blocks/discord-clone/page.tsx?raw'
import type { LiveSpec } from '../frame'
import raw from './chat-shell-compositions.tsx?raw'
import { Window, examples } from './chrome'

/** Lays a fixed-size composition out at its design width, scaled down (never up) to fit. */
function Scaled({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const host = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const el = host.current
    if (!el) return
    const resize = () => setScale(Math.min(1, el.clientWidth / width))
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(el)
    return () => observer.disconnect()
  }, [width])
  return (
    <div ref={host} style={{ width: '100%', maxWidth: width, margin: '0 auto', height: height * scale, position: 'relative', overflow: 'hidden', borderRadius: 12 }}>
      <div style={{ position: 'absolute', width, height, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}

const frame = (height: number): CSSProperties => ({ height, display: 'flex' })

// #region chatshell_dm
const people: Record<string, ChatUser> = {
  maya: { name: 'Maya', c: '#FF375F', role: '#FF8FA8' },
  jonas: { name: 'Jonas', c: '#30B0C7', role: '#7FD6E6' },
  priya: { name: 'Priya', c: '#FF9F0A', role: '#FFC46B' },
  me: { name: 'Ada', c: '#0A84FF', role: '#7EB6FF' },
}

const history: Record<string, [string, string][]> = {
  maya: [['maya', 'Did the morph land?'], ['me', 'Spring on transform, not layout. Buttery.'], ['maya', 'Ship it 🚢']],
  jonas: [['jonas', 'Can you review the rail PR?']],
  priya: [['priya', 'Lunch Thursday?']],
}

// No rail: a DM list in the sidebar and one conversation. Below 640px the list becomes a drawer.
export function DirectMessages() {
  const [who, setWho] = useState('maya')
  return (
    <ChatUsersProvider users={people}>
      <ChatShell breakpoint={640}>
        <ChatShellNav>
          <ChatShellSidebar>
            <ServerHeader>Direct messages</ServerHeader>
            <ChannelList selectedKey={who} onSelectionChange={setWho}>
              <ChannelGroup label="Recent">
                {['maya', 'jonas', 'priya'].map((id) => (
                  <ChannelItem key={id} id={id} icon={<ChatAvatar user={people[id]} size={18} />} mentions={id === 'jonas' ? 1 : undefined}>
                    {people[id].name}
                  </ChannelItem>
                ))}
              </ChannelGroup>
            </ChannelList>
          </ChatShellSidebar>
        </ChatShellNav>
        <ChatShellMain>
          <ChatShellHeader>
            <ChatShellNavTrigger />
            <ChatAvatar user={people[who]} size={22} />
            <ChatShellTitle>{people[who].name}</ChatShellTitle>
          </ChatShellHeader>
          <MessageList scrollKey={who}>
            {history[who].map(([from, text], i) => (
              <Message key={i} user={people[from]}>
                <MessageAvatar />
                <MessageBody>
                  <MessageHeader>
                    <MessageAuthor />
                    <MessageTimestamp>Today</MessageTimestamp>
                  </MessageHeader>
                  <MessageContent>{text}</MessageContent>
                </MessageBody>
              </Message>
            ))}
          </MessageList>
          <ChatShellFooter>
            <ChatComposer placeholder={'Message ' + people[who].name} onSend={() => {}} />
          </ChatShellFooter>
        </ChatShellMain>
      </ChatShell>
    </ChatUsersProvider>
  )
}
// #endregion

// #region chatshell_thread
const team: Record<string, ChatUser> = {
  noor: { name: 'Noor', c: '#FF9F0A', role: '#FFC46B' },
  theo: { name: 'Theo', c: '#32D74B', role: '#8CE8A5' },
  bot: { name: 'Stitch', c: '#5E5CE6', role: '#A6A5F2', bot: true },
}

function Line({ user, time, children }: { user: ChatUser; time: string; children: string }) {
  return (
    <Message user={user}>
      <MessageAvatar />
      <MessageBody>
        <MessageHeader>
          <MessageAuthor />
          {user.bot && <MessageBadge>APP</MessageBadge>}
          <MessageTimestamp>{time}</MessageTimestamp>
        </MessageHeader>
        <MessageContent>{children}</MessageContent>
      </MessageBody>
    </Message>
  )
}

// The thread opens in a ChatShellPanel: docked beside the channel on wide shells, over it on narrow ones.
export function ThreadPanel() {
  const [open, setOpen] = useState(true)
  return (
    <ChatUsersProvider users={team}>
      <ChatShell>
        <ChatShellMain>
          <ChatShellHeader>
            <ChatShellHeaderIcon />
            <ChatShellTitle>deploys</ChatShellTitle>
            <ChatShellDescription>Every push to main</ChatShellDescription>
          </ChatShellHeader>
          <MessageList>
            <Message user={team.bot}>
              <MessageAvatar />
              <MessageBody>
                <MessageHeader>
                  <MessageAuthor />
                  <MessageBadge>APP</MessageBadge>
                  <MessageTimestamp>7:02 AM</MessageTimestamp>
                </MessageHeader>
                <MessageContent>Deploy docs@4f21c9 → prod failed a smoke check.</MessageContent>
                <ThreadPreview title="Smoke check: /chat-shell" count={2} onPress={() => setOpen(true)}>
                  <ThreadPreviewReply user={team.theo}>Re-ran it, green now.</ThreadPreviewReply>
                </ThreadPreview>
              </MessageBody>
              <MessageActions>
                <MessageAction label="Open thread" onPress={() => setOpen(true)}>
                  <ChatIcon d={chatIconPaths.thread} size={14} />
                </MessageAction>
              </MessageActions>
            </Message>
          </MessageList>
          <ChatShellFooter>
            <ChatComposer placeholder="Message #deploys" onSend={() => {}} />
          </ChatShellFooter>
        </ChatShellMain>
        <ChatShellPanel open={open} onOpenChange={setOpen} dockWidth={600} width={300}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <MessageList className="pt-1">
              <ThreadHeader title="Smoke check: /chat-shell" description="Started by Stitch in #deploys" />
              <MessageDivider>2 replies</MessageDivider>
              <Line user={team.noor} time="7:05 AM">Flaky font load, I think.</Line>
              <Line user={team.theo} time="7:09 AM">Re-ran it, green now.</Line>
            </MessageList>
            <ChatShellFooter className="px-3">
              <ChatComposer placeholder="Reply in thread" onSend={() => {}} />
            </ChatShellFooter>
          </div>
        </ChatShellPanel>
      </ChatShell>
    </ChatUsersProvider>
  )
}
// #endregion

// #region chatshell_stack
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

// A phone stack from SplitView: compact shows one column at a time — pick a channel to push the
// conversation, back / edge-swipe / Esc to pop. Wider, the same two columns tile.
export function MobileStack() {
  return (
    <ChatShell>
      <SplitView defaultSelection={{ sidebar: 'design' }} defaultCompactColumn="sidebar" className="bg-ck-bg">
        <SplitViewSidebar width={240} className="bg-ck-side">
          <Rooms />
        </SplitViewSidebar>
        <SplitViewDetail className="bg-ck-bg">
          <Room />
        </SplitViewDetail>
      </SplitView>
    </ChatShell>
  )
}
// #endregion

// #region chatshell_support
const agent: ChatUser = { name: 'Juniper', c: '#30B06E', role: '#30B06E' }
const you: ChatUser = { name: 'You', c: '#8E8E93', role: '#8E8E93' }

// The smallest shell: no navigation at all — a support widget in the product's accent.
export function SupportChat() {
  const [log, setLog] = useState([{ from: agent, text: 'Hi! What can I help with today?' }])
  const [typing, setTyping] = useState(false)
  const send = (text: string) => {
    setLog((l) => [...l, { from: you, text }])
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setLog((l) => [...l, { from: agent, text: 'Thanks — looking into that now.' }])
    }, 1500)
  }
  return (
    <ChatShell tint="#30B06E">
      <ChatShellMain>
        <ChatShellHeader>
          <ChatAvatar user={agent} size={24} status="online" />
          <ChatShellTitle>Support</ChatShellTitle>
          <ChatShellDescription>Replies in a few minutes</ChatShellDescription>
          <ChatShellHeaderActions>
            <ChatShellHeaderAction aria-label="Close">
              <ChatIcon d={chatIconPaths.x} size={15} />
            </ChatShellHeaderAction>
          </ChatShellHeaderActions>
        </ChatShellHeader>
        <MessageList>
          {log.map((m, i) => (
            <Message key={i} user={m.from} appear={i > 0}>
              <MessageAvatar size={28} />
              <MessageBody>
                <MessageHeader>
                  <MessageAuthor />
                </MessageHeader>
                <MessageContent>{m.text}</MessageContent>
              </MessageBody>
            </Message>
          ))}
          {typing && <TypingIndicator>Juniper is typing…</TypingIndicator>}
        </MessageList>
        <ChatShellFooter>
          <ChatComposer placeholder="Write a message…" onSend={send} />
        </ChatShellFooter>
      </ChatShellMain>
    </ChatShell>
  )
}
// #endregion

// #region chatshell_rail
// Hover a tile: it rounds from a circle to a squircle and the pill on its edge grows from the unread
// nub. Select one: the pill runs full height on a springy curve. Up / Down move between tiles.
export function Rail() {
  return (
    <WorkspaceRail defaultSelectedKey="blui">
      <WorkspaceRailList>
        <WorkspaceRailHome unread />
        <WorkspaceRailSeparator />
        <WorkspaceRailItem id="blui" label="B" color="#0A84FF" title="BL UI HQ" />
        <WorkspaceRailItem id="creamery" label="C" color="#BF5AF2" title="Creamery" unread />
        <WorkspaceRailItem id="lab" label="L" color="#30D158" title="Motion Lab" mentions={3} />
      </WorkspaceRailList>
      <WorkspaceRailAction aria-label="Add workspace" />
    </WorkspaceRail>
  )
}
// #endregion

// #region chatshell_user
// The foot of the sidebar: who you are, your presence, and quick actions.
export function Me() {
  const me: ChatUser = { name: 'Ada', c: '#0A84FF', role: '#7EB6FF' }
  return (
    <UserPanel>
      <ChatAvatar user={me} size={26} status="online" />
      <UserPanelInfo>
        <UserPanelName>Ada Lovelace</UserPanelName>
        <UserPanelStatus status="online" />
      </UserPanelInfo>
    </UserPanel>
  )
}
// #endregion

export const CHAT_SHELL_EXAMPLES: Record<string, LiveSpec> = {
  chatshell: {
    title: 'Discord clone · the registry block', theme: 'bl', h: 580,
    variants: [{ id: 'wide', label: 'Wide' }, { id: 'members', label: 'Members' }, { id: 'compact', label: 'Compact' }],
    variantsWidth: 280,
    code: blockSource,
    Render: function DiscordLive({ variant }) {
      const width = variant === 'compact' ? 430 : variant === 'members' ? 1400 : 1040
      return (
        <div>
          <Scaled width={width} height={560}>
            <DiscordClone key={variant} defaultThread={null} style={{ width: '100%', height: '100%' }} />
          </Scaled>
          <div style={{ fontSize: 12, color: 'var(--bl-label2)', textAlign: 'center', marginTop: 8 }}>
            {variant === 'compact'
              ? 'Compact: the hamburger opens the rail and channels as one drawer.'
              : variant === 'members'
                ? 'From 1320px the member list docks as a ChatShellAside.'
                : 'Wide: rail and channels dock; open a thread preview to dock its panel.'}
          </div>
        </div>
      )
    },
  },
  ...examples(raw, [
    {
      id: 'chatshell_dm',
      title: 'Direct messages · two columns',
      h: 440,
      Render: () => (
        <Window>
          <div style={frame(420)}>
            <DirectMessages />
          </div>
        </Window>
      ),
    },
    {
      id: 'chatshell_thread',
      title: 'Thread side panel · ChatShellPanel',
      h: 420,
      Render: () => (
        <Window>
          <div style={frame(400)}>
            <ThreadPanel />
          </div>
        </Window>
      ),
    },
    {
      id: 'chatshell_stack',
      title: 'Compact stack · SplitView',
      h: 560,
      variants: [{ id: 'phone', label: 'Phone' }, { id: 'tablet', label: 'Tablet' }],
      Render: ({ variant }) => (
        <Window width={variant === 'phone' ? 390 : undefined}>
          <div style={frame(540)}>
            <MobileStack key={variant} />
          </div>
        </Window>
      ),
    },
    {
      id: 'chatshell_support',
      title: 'Support chat · just ChatShellMain',
      h: 460,
      Render: () => (
        <Window width={380}>
          <div style={frame(440)}>
            <SupportChat />
          </div>
        </Window>
      ),
    },
    {
      id: 'chatshell_rail',
      title: 'WorkspaceRail · the pill and tile morph',
      h: 330,
      Render: () => (
        <Window width={320}>
          <ChatShell style={{ height: 300 }}>
            <Rail />
            <div style={{ flex: 1, padding: 18, fontSize: 13, lineHeight: 1.5, color: 'var(--ck-mut)' }}>
              Hover and select the tiles: corners and the pill spring between states.
            </div>
          </ChatShell>
        </Window>
      ),
    },
    {
      id: 'chatshell_user',
      title: 'UserPanel',
      h: 120,
      Render: () => (
        <Window width={260}>
          <ChatShell style={{ height: 'auto' }}>
            <div style={{ flex: 1, background: 'var(--ck-side)' }}>
              <Me />
            </div>
          </ChatShell>
        </Window>
      ),
    },
  ]),
}
