import { Fragment, useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  ChannelGroup,
  ChannelIntro,
  ChannelItem,
  ChannelList,
  ChannelThreadItem,
  ChatAvatar,
  ChatComposer,
  ChatIcon,
  chatIconPaths,
  ChatShell,
  ChatShellAside,
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
  MemberGroup,
  MemberItem,
  MemberList,
  MessageList,
  ServerHeader,
  TypingIndicator,
  UserPanel,
  UserPanelAction,
  UserPanelInfo,
  UserPanelName,
  UserPanelStatus,
  useChatShell,
  WorkspaceRail,
  WorkspaceRailAction,
  WorkspaceRailItem,
  WorkspaceRailList,
  type Appearance,
} from '@brett_lamy/ui';
import { ChannelMessage } from './channel-message';
import { ThreadView } from './thread-view';
import { BOT_REPLY, CHANNELS, ME, PRESENCE, USERS, WORKSPACES, type Channel, type MessageData } from './data';

/** An open thread: beside the channel (`panel`) or in place of it (`full`). */
export interface ThreadState {
  id: string;
  mode: 'panel' | 'full';
}

export interface DiscordCloneProps {
  tint?: string;
  /** Light or dark. Defaults to the ambient AppearanceProvider, else dark. */
  appearance?: Appearance;
  /** show the member list when there's room (≥1320px) */
  showMembers?: boolean;
  /** thread open at mount; pass null for none */
  defaultThread?: ThreadState | null;
  className?: string;
  style?: CSSProperties;
}

const groups = [...new Set(CHANNELS.map((c) => c.group))];

export default function DiscordClone({
  tint = '#0A84FF',
  appearance,
  showMembers = true,
  defaultThread = { id: 'd4', mode: 'panel' },
  className,
  style,
}: DiscordCloneProps) {
  const chat = useChannels();
  const [channelId, setChannelId] = useState('dev');
  const [thread, setThread] = useState<ThreadState | null>(defaultThread);
  const [membersOpen, setMembersOpen] = useState(showMembers);
  const channel = chat.channels.find((c) => c.id === channelId)!;
  const threadMessage = thread ? channel.messages.find((m) => m.id === thread.id && m.thread) : undefined;
  const threadView = (mode: ThreadState['mode']) =>
    threadMessage && (
      <ThreadView
        message={threadMessage}
        channelName={channel.name}
        mode={mode}
        onToggleReaction={(emoji) => chat.toggleReaction(channelId, threadMessage.id, emoji)}
        onReply={(text) => chat.reply(channelId, threadMessage.id, text)}
      />
    );

  return (
    <ChatUsersProvider users={USERS}>
      <ChatShell tint={tint} appearance={appearance} className={className} style={style}>
        <ChatShellNav>
          <WorkspaceRail defaultSelectedKey="blui">
            <WorkspaceRailList>
              {WORKSPACES.map((w) => (
                <WorkspaceRailItem key={w.id} {...w} />
              ))}
            </WorkspaceRailList>
            <WorkspaceRailAction aria-label="Add workspace" />
          </WorkspaceRail>
          <ChatShellSidebar>
            <ServerHeader>BL UI HQ</ServerHeader>
            <ChannelList
              selectedKey={channelId}
              onSelectionChange={(id) => {
                setChannelId(id);
                setThread(null);
              }}
            >
              {groups.map((group) => (
                <ChannelGroup key={group} label={group}>
                  {chat.channels
                    .filter((c) => c.group === group)
                    .map((c) => (
                      <Fragment key={c.id}>
                        <ChannelItem id={c.id} unread={c.unread} mentions={c.mentions}>
                          {c.name}
                        </ChannelItem>
                        {c.id === channelId &&
                          c.messages
                            .filter((m) => m.thread)
                            .map((m) => (
                              <ChannelThreadItem
                                key={m.id}
                                isActive={thread?.mode === 'full' && thread.id === m.id}
                                onPress={() => setThread({ id: m.id, mode: 'full' })}
                              >
                                {m.thread!.title}
                              </ChannelThreadItem>
                            ))}
                      </Fragment>
                    ))}
                </ChannelGroup>
              ))}
            </ChannelList>
            <UserPanel>
              <ChatAvatar user={USERS[ME]} size={26} />
              <UserPanelInfo>
                <UserPanelName>{USERS[ME].name}</UserPanelName>
                <UserPanelStatus status={PRESENCE[ME]} />
              </UserPanelInfo>
              <UserPanelAction aria-label="Notifications">
                <ChatIcon d={chatIconPaths.bell} size={14} />
              </UserPanelAction>
            </UserPanel>
          </ChatShellSidebar>
        </ChatShellNav>

        <ChatShellMain>
          {thread?.mode === 'full' && threadMessage ? (
            <>
              <ChatShellHeader>
                <ChatShellNavTrigger />
                <ChatShellBack onPress={() => setThread(null)}>#{channel.name}</ChatShellBack>
                <ChatShellHeaderIcon>
                  <ChatIcon d={chatIconPaths.thread} size={14} />
                </ChatShellHeaderIcon>
                <ChatShellTitle>{threadMessage.thread!.title}</ChatShellTitle>
                <ChatShellHeaderActions>
                  <ChatShellHeaderAction variant="outline" onPress={() => setThread({ id: thread.id, mode: 'panel' })}>
                    Open as drawer
                  </ChatShellHeaderAction>
                </ChatShellHeaderActions>
              </ChatShellHeader>
              <div className="min-h-0 flex-1">{threadView('full')}</div>
            </>
          ) : (
            <>
              <ChannelHeader
                channel={channel}
                membersOn={membersOpen && !thread}
                onToggleMembers={() => setMembersOpen((o) => !o)}
              />
              <MessageList scrollKey={channel.id}>
                <ChannelIntro title={<>Welcome to #{channel.name}</>}>Hover a message to react or start a thread.</ChannelIntro>
                <DateDivider>August 12, 2026</DateDivider>
                {channel.messages.map((m) => (
                  <ChannelMessage
                    key={m.id}
                    message={m}
                    appear={chat.isNew(m.id)}
                    onToggleReaction={(emoji) => chat.toggleReaction(channelId, m.id, emoji)}
                    onOpenThread={() => {
                      if (!m.thread) chat.startThread(channelId, m.id);
                      setThread({ id: m.id, mode: 'panel' });
                    }}
                  />
                ))}
                {chat.typing === channelId && <TypingIndicator>{USERS[BOT_REPLY.user].name} is typing…</TypingIndicator>}
              </MessageList>
              <ChatShellFooter>
                <ChatComposer placeholder={'Message #' + channel.name} onSend={(text) => chat.send(channelId, text)} />
              </ChatShellFooter>
            </>
          )}
        </ChatShellMain>

        <ChatShellAside open={membersOpen && !thread}>
          <MemberList>
            {(['online', 'offline'] as const).map((state) => {
              const ids = Object.keys(USERS).filter((id) => (PRESENCE[id] === 'offline') === (state === 'offline'));
              return (
                <MemberGroup key={state} label={state === 'online' ? 'Online' : 'Offline'} count={ids.length}>
                  {ids.map((id) => (
                    <MemberItem key={id} user={USERS[id]} status={PRESENCE[id]} />
                  ))}
                </MemberGroup>
              );
            })}
          </MemberList>
        </ChatShellAside>

        <ChatShellPanel open={thread?.mode === 'panel' && !!threadMessage} onOpenChange={(open) => !open && setThread(null)}>
          {thread?.mode === 'panel' && threadView('panel')}
        </ChatShellPanel>
      </ChatShell>
    </ChatUsersProvider>
  );
}

/** The channel's title bar. Inside the shell, so it can ask whether the member list has room to dock. */
function ChannelHeader({ channel, membersOn, onToggleMembers }: { channel: Channel; membersOn: boolean; onToggleMembers: () => void }) {
  const { width } = useChatShell();
  return (
    <ChatShellHeader>
      <ChatShellNavTrigger />
      <ChatShellHeaderIcon />
      <ChatShellTitle>{channel.name}</ChatShellTitle>
      <ChatShellDescription>{channel.topic}</ChatShellDescription>
      <ChatShellHeaderActions>
        <ChatShellHeaderAction aria-label="Members" isActive={membersOn && width >= 1320} onPress={onToggleMembers}>
          <ChatIcon d={chatIconPaths.people} size={16} />
        </ChatShellHeaderAction>
      </ChatShellHeaderActions>
    </ChatShellHeader>
  );
}

/* ── State: channels, reactions, threads, and a bot that answers ── */
function useChannels() {
  const [channels, setChannels] = useState<Channel[]>(CHANNELS);
  const [typing, setTyping] = useState<string | null>(null);
  const fresh = useRef(new Set<string>());
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const updateMessage = (channelId: string, id: string, fn: (m: MessageData) => MessageData) =>
    setChannels((cs) =>
      cs.map((c) => (c.id === channelId ? { ...c, messages: c.messages.map((m) => (m.id === id ? fn(m) : m)) } : c)),
    );
  const post = (channelId: string, user: string, text: string) => {
    const id = 'm' + Date.now();
    fresh.current.add(id);
    setChannels((cs) =>
      cs.map((c) => (c.id === channelId ? { ...c, messages: [...c.messages, { id, user, time: 'now', text, reactions: [] }] } : c)),
    );
  };

  return {
    channels,
    typing,
    isNew: (id: string) => fresh.current.has(id),
    send(channelId: string, text: string) {
      post(channelId, ME, text);
      timers.current.push(
        setTimeout(() => setTyping(channelId), 600),
        setTimeout(() => {
          setTyping(null);
          post(channelId, BOT_REPLY.user, BOT_REPLY.text);
        }, 2200),
      );
    },
    toggleReaction(channelId: string, id: string, emoji: string) {
      updateMessage(channelId, id, (m) => {
        const has = m.reactions.some((r) => r.emoji === emoji);
        const reactions = has ? m.reactions : [...m.reactions, { emoji, count: 0, mine: false }];
        return {
          ...m,
          reactions: reactions
            .map((r) => (r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r))
            .filter((r) => r.count > 0),
        };
      });
    },
    startThread(channelId: string, id: string) {
      updateMessage(channelId, id, (m) => ({
        ...m,
        thread: { title: m.text.slice(0, 36) + (m.text.length > 36 ? '…' : ''), replies: [] },
      }));
    },
    reply(channelId: string, id: string, text: string) {
      updateMessage(channelId, id, (m) => ({
        ...m,
        thread: { ...m.thread!, replies: [...m.thread!.replies, { id: 't' + Date.now(), user: ME, time: 'now', text }] },
      }));
    },
  };
}
