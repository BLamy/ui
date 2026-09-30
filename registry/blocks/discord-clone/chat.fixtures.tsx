/* Story fixtures for the block's chat parts (stories only — not a block file, so not installed). */
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { Icon } from '@/lib/icon';
import { themeScopeProps, type Appearance } from '@/lib/theme';
import { cn } from '@/lib/utils';
import { ChatShellSidebar } from './components/chat-shell';
import type { ChatUsers } from './components/chat-users';
import { ChatAvatar } from './components/chat-avatar';
import { ChannelGroup, ChannelItem, ChannelList, ChannelThreadItem } from './components/channel-list';
import { ServerHeader } from './components/server-header';
import { UserPanel, UserPanelAction, UserPanelInfo, UserPanelName, UserPanelStatus } from './components/user-panel';

/** A story frame on the chat scope (dark by default). A plain element, not a `data-slot` part, so the story
    content keeps the page's own box model. */
export function ChatFrame({ appearance = 'dark', className, children }: { appearance?: Appearance; className?: string; children?: ReactNode }) {
  const scope = themeScopeProps({ scope: 'chat', appearance });
  return (
    <div data-theme-scope={scope['data-theme-scope']} className={cn(scope.className, 'bg-background text-foreground', className)}>
      {children}
    </div>
  );
}

export const USERS: ChatUsers = {
  ada: { name: 'Ada', c: '#0A84FF', role: '#7EB6FF' },
  miles: { name: 'Miles', c: '#BF5AF2', role: '#D8A9F0' },
  noor: { name: 'Noor', c: '#FF9F0A', role: '#FFC46B' },
  theo: { name: 'Theo', c: '#32D74B', role: '#8CE8A5' },
  stitch: { name: 'Stitch', c: '#5E5CE6', role: '#A6A5F2', bot: true },
};

export const CHANNEL_GROUPS: { label: string; channels: { id: string; name: string; unread?: boolean; threads?: { id: string; title: string }[] }[] }[] = [
  {
    label: 'Team',
    channels: [
      { id: 'general', name: 'general' },
      {
        id: 'dev',
        name: 'dev',
        unread: true,
        threads: [
          { id: 'd2', title: 'eval PR prompts / comments' },
          { id: 'd3', title: 'More relevant bugs' },
          { id: 'd4', title: 'Repo connect spawning new project' },
        ],
      },
      { id: 'design', name: 'design' },
    ],
  },
  {
    label: 'Workstreams',
    channels: [
      { id: 'ws-haptics', name: 'ws-haptics' },
      { id: 'ws-docs', name: 'ws-docs', unread: true },
    ],
  },
  { label: 'Bots', channels: [{ id: 'bot-alerts', name: 'bot-alerts' }] },
];

export function FixtureUserPanel() {
  return (
    <UserPanel>
      <ChatAvatar user={USERS.ada} size={26} />
      <UserPanelInfo>
        <UserPanelName>Ada</UserPanelName>
        <UserPanelStatus status="online" />
      </UserPanelInfo>
      <UserPanelAction aria-label="Notifications">
        <Icon name="bell-simple" size={14} sw={1.9} />
      </UserPanelAction>
    </UserPanel>
  );
}

export interface FixtureSidebarProps {
  selected: string;
  onSelect?: (id: string) => void;
  onPickThread?: (channel: string, thread: string) => void;
  title?: ReactNode;
  onClose?: () => void;
  /** replaces the UserPanel; null for none */
  footer?: ReactNode;
  style?: CSSProperties;
}

/** The whole channel sidebar, composed from the parts. */
export function FixtureSidebar({ selected, onSelect, onPickThread, title = 'BL UI HQ', onClose, footer, style }: FixtureSidebarProps) {
  return (
    <ChatShellSidebar style={style}>
      <ServerHeader onClose={onClose}>{title}</ServerHeader>
      <ChannelList selectedKey={selected} onSelectionChange={onSelect}>
        {CHANNEL_GROUPS.map((g) => (
          <ChannelGroup key={g.label} label={g.label}>
            {g.channels.map((c) => (
              <Fragment key={c.id}>
                <ChannelItem id={c.id} unread={c.unread}>
                  {c.name}
                </ChannelItem>
                {c.id === selected &&
                  c.threads?.map((t) => (
                    <ChannelThreadItem key={t.id} onPress={() => onPickThread?.(c.id, t.id)}>
                      {t.title}
                    </ChannelThreadItem>
                  ))}
              </Fragment>
            ))}
          </ChannelGroup>
        ))}
      </ChannelList>
      {footer === undefined ? <FixtureUserPanel /> : footer}
    </ChatShellSidebar>
  );
}
