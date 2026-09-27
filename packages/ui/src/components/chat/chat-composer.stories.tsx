import type { Meta, StoryObj } from '@storybook/react-vite';
import { chatTokens } from '../../lib/chat/chat-tokens';
import { ChatComposer } from './chat-composer';
import '../../styles.css';

const meta: Meta<typeof ChatComposer> = {
  title: 'Molecules/Composer',
  component: ChatComposer,
  args: { tint: '#0A84FF', onSend: () => {} },
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
type Story = StoryObj<typeof ChatComposer>;

export const Default: Story = {
  args: { placeholder: 'Message #dev' },
};

export const ThreadReply: Story = {
  args: { placeholder: 'Reply in "Repo connect spawning new project"', autoFocus: true },
};

export const PurpleTint: Story = {
  args: { placeholder: 'Message #design', tint: '#BF5AF2' },
};
