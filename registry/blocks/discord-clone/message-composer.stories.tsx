import type { Meta, StoryObj } from '@storybook/react-vite';
import { ChatUsersProvider } from './components/chat-users';
import { MessageComposer } from './message-composer';
import { USERS, ChatFrame } from './chat.fixtures';

const meta: Meta<typeof MessageComposer> = {
  title: 'Molecules/MessageComposer',
  component: MessageComposer,
  args: { onSend: () => {} },
  decorators: [
    (Story) => (
      <ChatUsersProvider users={USERS}>
        <ChatFrame className="w-[480px] rounded-[12px] p-6">
          <Story />
        </ChatFrame>
      </ChatUsersProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof MessageComposer>;

/** The core Composer: Docstream editor, attach, send. "@" offers the chat's users, "#" its channels. */
export const Default: Story = {
  args: { placeholder: 'Message #dev', channels: ['general', 'dev', 'design'] },
};

export const ThreadReply: Story = {
  args: { placeholder: 'Reply in "Repo connect spawning new project"', autoFocus: true },
};

/** The draft is Markdown, so pasted text with structure arrives with it. */
export const WithDraft: Story = {
  args: { placeholder: 'Message #dev', defaultValue: 'Ship it, **@miles** — see `chat.fixtures.tsx`.' },
};
