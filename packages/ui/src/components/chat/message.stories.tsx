import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon } from '../../lib/icon';
import { ChatUsersProvider } from '../../lib/chat/chat-users';
import {
  Message,
  MessageAction,
  MessageActions,
  MessageAuthor,
  MessageAvatar,
  MessageBadge,
  MessageBody,
  MessageContent,
  MessageHeader,
  MessageReaction,
  MessageReactions,
  MessageTimestamp,
} from './message';
import { MessageGroup } from './message-list';
import { ThreadPreview, ThreadPreviewReply } from './thread-preview';
import { USERS, ChatFrame } from './chat.fixtures';
import '../../styles.css';

interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}
interface Args {
  user: keyof typeof USERS & string;
  time: string;
  text: string;
  reactions: Reaction[];
  thread?: { title: string; replies: { user: string; text: string }[] };
}

/** A data-driven row, composed from the parts — what an app writes once. */
function Row({ user, time, text, reactions: initial, thread }: Args) {
  const [reactions, setReactions] = useState(initial);
  const u = USERS[user];
  const toggle = (emoji: string) =>
    setReactions((rs) => {
      const list = rs.some((r) => r.emoji === emoji) ? rs : [...rs, { emoji, count: 0, mine: false }];
      return list.map((r) => (r.emoji === emoji ? { ...r, mine: !r.mine, count: r.count + (r.mine ? -1 : 1) } : r)).filter((r) => r.count > 0);
    });
  const last = thread?.replies[thread.replies.length - 1];
  return (
    <Message user={u}>
      <MessageAvatar />
      <MessageBody>
        <MessageHeader>
          <MessageAuthor />
          {u.bot && <MessageBadge>APP</MessageBadge>}
          <MessageTimestamp>{time}</MessageTimestamp>
        </MessageHeader>
        <MessageContent>{text}</MessageContent>
        {reactions.length > 0 && (
          <MessageReactions>
            {reactions.map((r) => (
              <MessageReaction key={r.emoji} emoji={r.emoji} count={r.count} mine={r.mine} onChange={() => toggle(r.emoji)} />
            ))}
          </MessageReactions>
        )}
        {thread && (
          <ThreadPreview title={thread.title} count={thread.replies.length}>
            {last && <ThreadPreviewReply user={USERS[last.user]}>{last.text}</ThreadPreviewReply>}
          </ThreadPreview>
        )}
      </MessageBody>
      <MessageActions>
        <MessageAction label="Add 👍" onPress={() => toggle('👍')}>
          👍
        </MessageAction>
        <MessageAction label={thread ? 'Open thread' : 'Start thread'}>
          <Icon name="text-bubble" size={14} sw={1.9} />
        </MessageAction>
      </MessageActions>
    </Message>
  );
}

const meta: Meta<Args> = {
  title: 'Molecules/Message',
  render: (args) => <Row {...args} />,
  parameters: {
    docs: {
      description: {
        component:
          'Message › MessageAvatar · MessageBody (MessageHeader › MessageAuthor · MessageBadge · MessageTimestamp, MessageContent, MessageReactions › MessageReaction, ThreadPreview) · MessageActions › MessageAction. Hover a row for its action bar; reactions are toggles.',
      },
    },
  },
  args: { reactions: [] },
  decorators: [
    (Story) => (
      <ChatUsersProvider users={USERS}>
        <ChatFrame className="w-[560px] rounded-[12px] py-6">
          <Story />
        </ChatFrame>
      </ChatUsersProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<Args>;

export const Default: Story = {
  args: { user: 'theo', time: '9:15 AM', text: 'Saw that — the Sidebar variants demo is really nice.' },
};

export const WithReactions: Story = {
  args: {
    user: 'ada',
    time: '11:45 AM',
    text: '@theo anecdotally I\'ve been seeing much better bugs — things like "I clicked this button and no sidebar opened".',
    reactions: [
      { emoji: '🎉', count: 1, mine: false },
      { emoji: '👍', count: 1, mine: true },
    ],
  },
};

export const WithThreadPreview: Story = {
  args: {
    user: 'theo',
    time: '11:49 AM',
    text: 'Added an issue for the thing from GTM planning — hub/RQI-108. fyi @ada, assigned to you.',
    thread: {
      title: 'Repo connect spawning new project',
      replies: [
        { user: 'theo', text: "Has the link to the customer's post in #general." },
        { user: 'ada', text: 'I do now 🙂' },
      ],
    },
  },
};

export const BotWithAppBadge: Story = {
  args: { user: 'stitch', time: '7:02 AM', text: 'Deploy blui-docs@4f21c9 → prod. 34s, all checks green.' },
};

/** A MessageGroup: the first row full, follow-ups `variant="continued"` (no avatar or header). */
export const Grouped: Story = {
  render: () => (
    <MessageGroup>
      <Message user={USERS.noor}>
        <MessageAvatar />
        <MessageBody>
          <MessageHeader>
            <MessageAuthor />
            <MessageTimestamp>9:12 AM</MessageTimestamp>
          </MessageHeader>
          <MessageContent>Morning! Docs site is organized by atomic tiers now.</MessageContent>
        </MessageBody>
      </Message>
      <Message user={USERS.noor} variant="continued">
        <MessageAvatar />
        <MessageBody>
          <MessageContent>Atoms, molecules, organisms, templates, pages.</MessageContent>
        </MessageBody>
      </Message>
      <Message user={USERS.noor} variant="continued">
        <MessageAvatar />
        <MessageBody>
          <MessageContent>@theo the Sidebar page moved under Organisms.</MessageContent>
        </MessageBody>
      </Message>
    </MessageGroup>
  ),
};
