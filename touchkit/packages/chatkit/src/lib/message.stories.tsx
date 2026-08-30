import type { Meta, StoryObj } from '@storybook/react-vite';
import { chatTokens } from './chat-tokens';
import { ChatUsersProvider } from './chat-users';
import { Message } from './message';
import { USERS } from '../demos/chat-demo';
import '../styles.css';

const noop = () => {};

const meta: Meta<typeof Message> = {
  title: 'Molecules/Message',
  component: Message,
  parameters: {
    docs: {
      description: {
        component:
          'Hover a message to reveal its floating action bar (top-right): 👍 quick-react, and start/open thread. Reactions toggle on click (own reaction highlighted in tint; count drops to 0 removes the pill).',
      },
    },
  },
  args: { tint: '#0A84FF', onReact: noop, onOpenThread: noop, onStartThread: noop },
  decorators: [
    (Story) => (
      <ChatUsersProvider users={USERS}>
        <div
          style={{
            width: 560,
            padding: '24px 0',
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
type Story = StoryObj<typeof Message>;

export const Default: Story = {
  parameters: {
    docs: {
      description: {
        story:
          'Hover the row to reveal the action bar: 👍 adds/toggles a thumbs-up reaction; the thread button starts a thread (or opens it if one exists).',
      },
    },
  },
  args: {
    m: { id: 'g2', u: 'theo', t: '9:15 AM', txt: 'Saw that — the Sidebar variants demo is really nice.', reacts: [] },
  },
};

export const WithReactions: Story = {
  args: {
    m: {
      id: 'd3',
      u: 'ada',
      t: '11:45 AM',
      txt: '@theo anecdotally I\'ve been seeing much better bugs — things like "I clicked this button and no sidebar opened".',
      reacts: [
        ['🎉', 1, false],
        ['👍', 1, true],
      ],
    },
  },
};

export const WithThreadPreview: Story = {
  args: {
    m: {
      id: 'd4',
      u: 'theo',
      t: '11:49 AM',
      txt: "Added an issue for the thing from GTM planning — hub/RQI-108. fyi @ada, assigned to you.",
      reacts: [],
      thread: {
        title: 'Repo connect spawning new project',
        msgs: [
          { id: 't1', u: 'theo', t: '11:49 AM', txt: "Has the link to the customer's post in #general." },
          { id: 't2', u: 'ada', t: '12:33 PM', txt: 'I do now 🙂' },
        ],
      },
    },
  },
};

export const BotWithAppBadge: Story = {
  args: {
    m: {
      id: 'b1',
      u: 'stitch',
      t: '7:02 AM',
      txt: 'Deploy touchkit-docs@4f21c9 → prod. 34s, all checks green.',
      reacts: [],
    },
  },
};
