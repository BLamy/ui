import './chat-theme.css';
import type { CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from '@brett_lamy/ui';
import { ChatComposer, ChatComposerAction, ChatComposerInput, ChatComposerSend } from './components/chat-composer';
import { ChatFrame } from './chat.fixtures';

interface Args {
  placeholder: string;
  autoFocus?: boolean;
  tint: string;
}

const meta: Meta<Args> = {
  title: 'Molecules/Composer',
  args: { tint: '#0A84FF' },
  render: ({ tint, ...args }) => <ChatComposer {...args} onSend={() => {}} style={{ '--primary': tint } as CSSProperties} />,
  decorators: [
    (Story) => (
      <ChatFrame className="w-[480px] rounded-[12px] p-6">
        <Story />
      </ChatFrame>
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

/** `--primary` (ChatShell's `tint`) colors the send button once there's a draft. */
export const PurpleTint: Story = {
  args: { placeholder: 'Message #design', tint: '#BF5AF2' },
};

/** Composed: an attach action before the input. */
export const WithAction: Story = {
  render: () => (
    <ChatComposer onSend={() => {}}>
      <ChatComposerAction aria-label="Attach">
        <Icon name="plus" size={16} sw={2.2} />
      </ChatComposerAction>
      <ChatComposerInput placeholder="Message #dev" />
      <ChatComposerSend />
    </ChatComposer>
  ),
};
