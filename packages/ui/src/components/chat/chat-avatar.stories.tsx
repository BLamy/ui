import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatAvatar } from './chat-avatar';
import { ChatFrame } from './chat.fixtures';
import '../../styles.css';

const meta: Meta<typeof ChatAvatar> = {
  title: 'Atoms/ChatAvatar',
  component: ChatAvatar,
  decorators: [
    (Story) => (
      <ChatFrame className="flex w-[320px] items-center gap-3 rounded-[12px] p-6">
        <Story />
      </ChatFrame>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ChatAvatar>;

export const Default: Story = {
  args: { user: { name: 'Ada', c: '#0A84FF', role: '#7EB6FF' }, size: 36 },
};

export const Bot: Story = {
  args: { user: { name: 'Stitch', c: '#5E5CE6', role: '#A6A5F2', bot: true }, size: 36, square: true },
};

export const Sizes: Story = {
  render: () => (
    <>
      <ChatAvatar user={{ name: 'Noor', c: '#FF9F0A', role: '#FFC46B' }} size={15} />
      <ChatAvatar user={{ name: 'Noor', c: '#FF9F0A', role: '#FFC46B' }} size={24} />
      <ChatAvatar user={{ name: 'Noor', c: '#FF9F0A', role: '#FFC46B' }} size={36} />
      <ChatAvatar user={{ name: 'Theo', c: '#32D74B', role: '#8CE8A5' }} size={48} />
    </>
  ),
};
