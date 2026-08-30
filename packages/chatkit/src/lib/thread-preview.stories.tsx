import type { Meta, StoryObj } from '@storybook/react-vite';
import { chatTokens } from './chat-tokens';
import { ChatUsersProvider } from './chat-users';
import { ThreadPreview } from './thread-preview';
import { USERS } from '../demos/chat-demo';
import '../styles.css';

const meta: Meta<typeof ThreadPreview> = {
  title: 'Molecules/ThreadPreview',
  component: ThreadPreview,
  args: { tint: '#0A84FF', onOpen: () => {} },
  decorators: [
    (Story) => (
      <ChatUsersProvider users={USERS}>
        <div
          style={{
            width: 560,
            padding: 24,
            background: chatTokens.bg,
            color: chatTokens.label,
            colorScheme: 'dark',
            borderRadius: 12,
          }}
        >
          <Story />
        </div>
      </ChatUsersProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof ThreadPreview>;

export const Default: Story = {
  args: {
    th: {
      title: 'More relevant bugs',
      msgs: [
        { id: 't1', u: 'theo', t: '12:02 PM', txt: 'Yeah, it recommended I tree-shake the icon set — 40% smaller.' },
        { id: 't2', u: 'ada', t: '12:04 PM', txt: 'Testing and Network categories are getting more results too.' },
      ],
    },
  },
};

export const SingleMessage: Story = {
  args: {
    th: {
      title: 'eval PR prompts / comments',
      msgs: [{ id: 't1', u: 'miles', t: '10:10 AM', txt: "I didn't tag it 🤷 but ok." }],
    },
  },
};

export const Empty: Story = {
  args: { th: { title: 'A brand new thread', msgs: [] } },
};
