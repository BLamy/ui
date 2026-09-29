import { useState, type ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  ChatShell,
  ChatShellAside,
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
  Icon,
  TabView,
  TabViewAction,
  TabViewBar,
  TabViewFooter,
  TabViewIndicator,
  TabViewList,
  TabViewTab,
  useChatShell,
} from '@brett_lamy/ui';
import { ChatUsersProvider, type ChatUser } from './components/chat-users';
import { ChatAvatar } from './components/chat-avatar';
import { ChannelGroup, ChannelItem, ChannelList } from './components/channel-list';
import { ChatComposer } from './components/chat-composer';
import { MemberGroup, MemberItem, MemberList } from './components/member-list';
import { Message, MessageAuthor, MessageAvatar, MessageBody, MessageContent, MessageHeader, MessageTimestamp } from './components/message';
import { DateDivider, MessageList, TypingIndicator } from './components/message-list';
import { ServerHeader } from './components/server-header';
import { ThreadHeader } from './components/thread-preview';
import { WorkspaceTile } from './components/workspace-rail';
import { FixtureSidebar, FixtureUserPanel, USERS } from './chat.fixtures';

/* ChatShell (a library template) composed with the discord-clone block's parts. */

interface FrameArgs {
  width: number;
  height: number;
  defaultNavOpen?: boolean;
}

function Frame({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  return (
    <ChatUsersProvider users={USERS}>
      <div className="overflow-hidden" style={{ width, height }}>{children}</div>
    </ChatUsersProvider>
  );
}

function DemoMain() {
  const { width, compact, setNavOpen } = useChatShell();
  return (
    <ChatShellMain className="font-ios">
      <div className="flex h-[46px] shrink-0 items-center gap-[9px] border-b border-border px-4">
        {compact && (
          <button
            onClick={() => setNavOpen(true)}
            aria-label="Channels"
            className="grid cursor-pointer border-0 bg-transparent p-1 text-muted-foreground"
          >
            <Icon name="line-3-horizontal" size={17} sw={2} />
          </button>
        )}
        <span className="text-[14px] font-[750]">Main slot</span>
      </div>
      <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">
        container width {width}px · {compact ? 'compact (drawer nav)' : 'wide (docked rail + nav)'}
      </div>
    </ChatShellMain>
  );
}

function ShellDemo({ width, height, defaultNavOpen }: FrameArgs) {
  const [cur, setCur] = useState('dev');
  return (
    <Frame width={width} height={height}>
      <ChatShell breakpoint={880} defaultNavOpen={defaultNavOpen}>
        <ChatShellNav>
          <TabView orientation="vertical" defaultSelectedKey="blui" className="contents">
            <TabViewBar variant="workspace">
              <TabViewList aria-label="Workspaces">
                <TabViewTab id="blui" textValue="BL UI HQ">
                  <TabViewIndicator variant="pill" />
                  <WorkspaceTile>T</WorkspaceTile>
                </TabViewTab>
                <TabViewTab id="creamery" textValue="Creamery">
                  <TabViewIndicator variant="pill" />
                  <WorkspaceTile color="#BF5AF2">C</WorkspaceTile>
                </TabViewTab>
              </TabViewList>
              <TabViewFooter>
                <TabViewAction aria-label="Add workspace" icon="plus" />
              </TabViewFooter>
            </TabViewBar>
          </TabView>
          <FixtureSidebar selected={cur} onSelect={setCur} />
        </ChatShellNav>
        <DemoMain />
      </ChatShell>
    </Frame>
  );
}

const meta: Meta<FrameArgs> = {
  title: 'Templates/ChatShell',
  render: (args) => <ShellDemo {...args} />,
  parameters: {
    docs: {
      description: {
        component:
          'ChatShell is a thin layout root (width → compact, nav drawer state, --ck-* tokens). Its regions — ChatShellNav, ChatShellSidebar, ChatShellMain, ChatShellHeader, ChatShellFooter, ChatShellAside, ChatShellPanel — are ordinary elements; leave out what a layout does not need.',
      },
    },
  },
};
export default meta;
type Story = StoryObj<FrameArgs>;

export const Wide: Story = {
  args: { width: 1100, height: 640 },
};

export const Compact: Story = {
  args: { width: 480, height: 640 },
};

/** Compact shell with the navigation drawer OPEN — rail + sidebar slide in over the scrim. */
export const CompactNavOpen: Story = {
  args: { width: 480, height: 640, defaultNavOpen: true },
  parameters: {
    docs: {
      description: {
        story: 'Below the breakpoint ChatShellNav becomes a left EdgeDrawer (dimmed scrim). Shown here open via defaultNavOpen.',
      },
    },
  },
};

/* ── Compositions ── */

const line = (user: ChatUser, time: string, text: string, key: string) => (
  <Message key={key} user={user}>
    <MessageAvatar />
    <MessageBody>
      <MessageHeader>
        <MessageAuthor />
        <MessageTimestamp>{time}</MessageTimestamp>
      </MessageHeader>
      <MessageContent>{text}</MessageContent>
    </MessageBody>
  </Message>
);

function Conversation({ name, icon, typing, children }: { name: string; icon?: ReactNode; typing?: string; children?: ReactNode }) {
  return (
    <ChatShellMain>
      <ChatShellHeader>
        <ChatShellNavTrigger />
        <ChatShellHeaderIcon>{icon}</ChatShellHeaderIcon>
        <ChatShellTitle>{name}</ChatShellTitle>
        <ChatShellDescription />
        {children}
      </ChatShellHeader>
      <MessageList>
        <DateDivider>August 12, 2026</DateDivider>
        {line(USERS.miles, '10:02 AM', 'Is the credenza morph on transform or layout?', 'a')}
        {line(USERS.ada, '10:04 AM', 'Transform — layout springs stutter on Safari. @miles want a pass on the docs demo?', 'b')}
        {line(USERS.miles, '10:05 AM', 'Yes please 🙏', 'c')}
        {typing && <TypingIndicator>{typing} is typing…</TypingIndicator>}
      </MessageList>
      <ChatShellFooter>
        <ChatComposer placeholder={'Message ' + name} onSend={() => {}} />
      </ChatShellFooter>
    </ChatShellMain>
  );
}

/** Two columns, no rail: a DM list in ChatShellSidebar and the conversation. */
export const DirectMessages: Story = {
  args: { width: 900, height: 560 },
  render: function DMs({ width, height }) {
    const [cur, setCur] = useState('miles');
    return (
      <Frame width={width} height={height}>
        <ChatShell breakpoint={640}>
          <ChatShellNav>
            <ChatShellSidebar>
              <ServerHeader>Direct messages</ServerHeader>
              <ChannelList selectedKey={cur} onSelectionChange={setCur}>
                <ChannelGroup label="Recent">
                  {(['miles', 'noor', 'theo', 'stitch'] as const).map((id) => (
                    <ChannelItem key={id} id={id} icon={<ChatAvatar user={USERS[id]} size={18} square={USERS[id].bot} />} unread={id === 'noor'}>
                      {USERS[id].name}
                    </ChannelItem>
                  ))}
                </ChannelGroup>
              </ChannelList>
              <FixtureUserPanel />
            </ChatShellSidebar>
          </ChatShellNav>
          <Conversation name={USERS[cur].name} icon={<ChatAvatar user={USERS[cur]} size={20} />} typing={USERS[cur].name} />
        </ChatShell>
      </Frame>
    );
  },
};

/** ChatShellPanel: a thread docked beside the conversation (≥1180px), or over it below that. */
export const ThreadPanel: Story = {
  args: { width: 1200, height: 560 },
  render: function Thread({ width, height }) {
    const [open, setOpen] = useState(true);
    return (
      <Frame width={width} height={height}>
        <ChatShell>
          <Conversation name="design">
            <ChatShellHeaderActions>
              <ChatShellHeaderAction aria-label="Thread" isActive={open} onPress={() => setOpen(!open)}>
                <Icon name="text-bubble" size={16} sw={1.9} />
              </ChatShellHeaderAction>
            </ChatShellHeaderActions>
          </Conversation>
          <ChatShellPanel open={open} onOpenChange={setOpen}>
            <div className="flex h-full flex-col">
              <MessageList className="pt-1">
                <ThreadHeader title="Credenza morph" description="Started by Miles in #design" />
                <div className="px-1 pt-2.5">{line(USERS.ada, '10:06 AM', 'Pushed: spring on transform, 0 layout reads.', 't1')}</div>
              </MessageList>
              <ChatShellFooter className="px-3">
                <ChatComposer placeholder="Reply in thread" onSend={() => {}} />
              </ChatShellFooter>
            </div>
          </ChatShellPanel>
        </ChatShell>
      </Frame>
    );
  },
};

/** ChatShellAside with a MemberList: docks from `minWidth` (1320 by default). */
export const MemberAside: Story = {
  args: { width: 1360, height: 560 },
  render: ({ width, height }) => (
    <Frame width={width} height={height}>
      <ChatShell>
        <Conversation name="general" />
        <ChatShellAside>
          <MemberList>
            <MemberGroup label="Online" count={3}>
              <MemberItem user={USERS.ada} status="online" />
              <MemberItem user={USERS.miles} status="idle" />
              <MemberItem user={USERS.stitch} status="online" />
            </MemberGroup>
            <MemberGroup label="Offline" count={1}>
              <MemberItem user={USERS.theo} status="offline" />
            </MemberGroup>
          </MemberList>
        </ChatShellAside>
      </ChatShell>
    </Frame>
  ),
};

/** Just the main region — a support widget, light. */
export const SupportWidget: Story = {
  args: { width: 380, height: 520 },
  render: ({ width, height }) => (
    <Frame width={width} height={height}>
      <ChatShell appearance="light" tint="#30B06E">
        <Conversation name="Support" icon={<ChatAvatar user={USERS.stitch} size={20} square />} typing="Stitch" />
      </ChatShell>
    </Frame>
  ),
};
