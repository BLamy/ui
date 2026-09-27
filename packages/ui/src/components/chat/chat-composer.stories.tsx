import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { chatTokens } from '../../lib/chat/chat-tokens';
import { ChatIcon, chatIconPaths } from '../../lib/chat/chat-icon';
import { ChatComposer, ChatComposerAction, ChatComposerInput, ChatComposerSend } from './chat-composer';
import '../../styles.css';

interface Args {
  placeholder: string;
  autoFocus?: boolean;
  tint: string;
}

const meta: Meta<Args> = {
  title: 'Molecules/Composer',
  args: { tint: '#0A84FF' },
  render: ({ tint, ...args }) => <ChatComposer {...args} onSend={() => {}} style={{ '--ck-tint': tint } as CSSProperties} />,
  decorators: [
    (Story) => (
      <div
        style={{
          width: 480,
          padding: 24,
          background: chatTokens.bg,
          color: chatTokens.label,
          colorScheme: 'dark',
          borderRadius: 12,
        }}
      >
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  args: { placeholder: 'Message #dev' },
};

export const ThreadReply: Story = {
  args: { placeholder: 'Reply in "Repo connect spawning new project"', autoFocus: true },
};

/** `--ck-tint` (ChatShell's `tint`) colors the send button once there's a draft. */
export const PurpleTint: Story = {
  args: { placeholder: 'Message #design', tint: '#BF5AF2' },
};

/** Composed: an attach action before the input. */
export const WithAction: Story = {
  render: () => (
    <ChatComposer onSend={() => {}}>
      <ChatComposerAction aria-label="Attach">
        <ChatIcon d={chatIconPaths.plus} size={16} sw={2.2} />
      </ChatComposerAction>
      <ChatComposerInput placeholder="Message #dev" />
      <ChatComposerSend />
    </ChatComposer>
  ),
};
