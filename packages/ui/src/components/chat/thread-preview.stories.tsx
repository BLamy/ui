import type { Meta, StoryObj } from '@storybook/react-vite';
import { ThreadHeader, ThreadPreview, ThreadPreviewReply } from './thread-preview';
import { USERS, ChatFrame } from './chat.fixtures';
import '../../styles.css';

interface Args {
  title: string;
  count: number;
  last?: { user: string; text: string };
}

const meta: Meta<Args> = {
  title: 'Molecules/ThreadPreview',
  render: ({ title, count, last }) => (
    <ThreadPreview title={title} count={count}>
      {last && <ThreadPreviewReply user={USERS[last.user]}>{last.text}</ThreadPreviewReply>}
    </ThreadPreview>
  ),
  decorators: [
    (Story) => (
      <ChatFrame className="w-[560px] rounded-[12px] p-6">
        <Story />
      </ChatFrame>
    ),
  ],
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  args: {
    title: 'More relevant bugs',
    count: 2,
    last: { user: 'ada', text: 'Testing and Network categories are getting more results too.' },
  },
};

export const SingleMessage: Story = {
  args: { title: 'eval PR prompts / comments', count: 1, last: { user: 'miles', text: "I didn't tag it 🤷 but ok." } },
};

export const Empty: Story = {
  args: { title: 'A brand new thread', count: 0 },
};

/** ThreadHeader: the title block at the top of an open thread. */
export const Header: Story = {
  render: () => <ThreadHeader title="Repo connect spawning new project" description="Started by Theo in #dev" />,
};
