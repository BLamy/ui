import * as React from 'react';
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChannelList } from './channel-list';
import { chatTokens } from './chat-tokens';
import { ChatUsersProvider } from './chat-users';
import { seed, USERS } from '../demos/chat-demo';
import '../styles.css';

const meta: Meta<typeof ChannelList> = {
  title: 'Organisms/ChannelList',
  component: ChannelList,
  args: { tint: '#0A84FF' },
  decorators: [
    (Story) => (
      <ChatUsersProvider users={USERS}>
        <div
          style={{
            width: 222,
            height: 640,
            background: chatTokens.bg,
            color: chatTokens.label,
            colorScheme: 'dark',
            overflow: 'hidden',
          }}
        >
          <Story />
        </div>
      </ChatUsersProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ChannelList>;

function Interactive(props: { onClose?: (() => void) | null; title?: string }) {
  const [cur, setCur] = useState('dev');
  return <ChannelList chans={seed()} cur={cur} onPick={(id) => setCur(id)} tint="#0A84FF" {...props} />;
}

export const Default: Story = {
  render: () => <Interactive />,
};

export const WithCloseButton: Story = {
  render: () => <Interactive onClose={() => {}} />,
};

/** The active channel expands its threads as indented sub-rows (elbow connector). #dev has three. */
export const ActiveChannelThreadRows: Story = {
  parameters: {
    docs: {
      description: {
        story:
          "Threads of the ACTIVE channel render as collapsed sub-rows under it — clicking one calls onPick(id, threadId) (opens the thread in full view in ChatDemo). Unread channels keep their tint dot until selected.",
      },
    },
  },
  render: () => {
    const [picked, setPicked] = React.useState<string>('');
    return (
      <ChannelList
        chans={seed()}
        cur="dev"
        tint="#0A84FF"
        onPick={(id, tid) => setPicked(tid ? `${id} → thread ${tid}` : id)}
        footer={
          <div style={{ padding: '9px 12px', fontSize: 11, color: chatTokens.mut3, borderTop: '1px solid ' + chatTokens.sep }}>
            picked: {picked || '—'}
          </div>
        }
      />
    );
  },
};

export const CustomTitleNoFooter: Story = {
  render: () => {
    const [cur, setCur] = useState('general');
    return (
      <ChannelList chans={seed()} cur={cur} onPick={setCur} tint="#BF5AF2" title="Creamery" footer={null} />
    );
  },
};
