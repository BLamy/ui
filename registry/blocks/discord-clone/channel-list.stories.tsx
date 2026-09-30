import { useState, type CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChannelGroup, ChannelItem, ChannelList } from './components/channel-list';
import { ChatAvatar } from './components/chat-avatar';
import { ServerHeader } from './components/server-header';
import { ChatShellSidebar } from './components/chat-shell';
import { ChatUsersProvider } from './components/chat-users';
import { FixtureSidebar, FixtureUserPanel, USERS, ChatFrame } from './chat.fixtures';

/* The channel sidebar: ChatShellSidebar › ServerHeader · ChannelList (ChannelGroup › ChannelItem,
   ChannelThreadItem) · UserPanel. */
const meta: Meta = {
  title: 'Organisms/ChannelList',
  decorators: [
    (Story) => (
      <ChatUsersProvider users={USERS}>
        <ChatFrame className="h-[640px] w-[222px] overflow-hidden">
          <Story />
        </ChatFrame>
      </ChatUsersProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj;

function Interactive(props: { onClose?: () => void }) {
  const [cur, setCur] = useState('dev');
  return <FixtureSidebar selected={cur} onSelect={setCur} {...props} />;
}

export const Default: Story = {
  render: () => <Interactive />,
};

/** `ServerHeader onClose` swaps the chevron for a close button (automatic inside a compact ChatShell). */
export const WithCloseButton: Story = {
  render: () => <Interactive onClose={() => {}} />,
};

/** The active channel lists its threads as ChannelThreadItems (elbow connector). #dev has three. */
export const ActiveChannelThreadRows: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Threads of the ACTIVE channel render as ChannelThreadItem rows under it. Unread channels keep their tint dot until selected.',
      },
    },
  },
  render: function ThreadRows() {
    const [picked, setPicked] = useState('');
    return (
      <FixtureSidebar
        selected="dev"
        onSelect={setPicked}
        onPickThread={(c, t) => setPicked(`${c} → thread ${t}`)}
        footer={
          <div className="border-t border-border px-3 py-[9px] text-[11px] text-tertiary-foreground">
            picked: {picked || '—'}
          </div>
        }
      />
    );
  },
};

export const CustomTitleNoFooter: Story = {
  render: function CustomTitle() {
    const [cur, setCur] = useState('general');
    return <FixtureSidebar selected={cur} onSelect={setCur} title="Creamery" footer={null} style={{ '--primary': '#BF5AF2' } as CSSProperties} />;
  },
};

/** Mention pills, and direct messages with avatars in place of the #. */
export const MentionsAndDirectMessages: Story = {
  render: function Mentions() {
    const [cur, setCur] = useState('general');
    return (
      <ChatShellSidebar>
        <ServerHeader>BL UI HQ</ServerHeader>
        <ChannelList selectedKey={cur} onSelectionChange={setCur}>
          <ChannelGroup label="Team">
            <ChannelItem id="general">general</ChannelItem>
            <ChannelItem id="dev" unread mentions={3}>
              dev
            </ChannelItem>
            <ChannelItem id="design" unread>
              design
            </ChannelItem>
          </ChannelGroup>
          <ChannelGroup label="Direct messages">
            {(['miles', 'noor', 'stitch'] as const).map((id, i) => (
              <ChannelItem key={id} id={'dm-' + id} icon={<ChatAvatar user={USERS[id]} size={18} square={USERS[id].bot} />} mentions={i === 1 ? 1 : undefined}>
                {USERS[id].name}
              </ChannelItem>
            ))}
          </ChannelGroup>
        </ChannelList>
        <FixtureUserPanel />
      </ChatShellSidebar>
    );
  },
};
