import { Icon } from '@/lib/icon';
import { useChatUsers } from './components/chat-users';
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
} from './components/message';
import { ThreadPreview, ThreadPreviewReply } from './components/thread-preview';
import type { MessageData } from './data';

export interface ChannelMessageProps {
  message: MessageData;
  onToggleReaction?: (emoji: string) => void;
  /** opens the message's thread (or starts one) */
  onOpenThread?: () => void;
  /** rise into place — for messages that just arrived */
  appear?: boolean;
}

/** One message, from the Message parts. */
export function ChannelMessage({ message, onToggleReaction, onOpenThread, appear }: ChannelMessageProps) {
  const users = useChatUsers();
  const user = users[message.user];
  const { thread } = message;
  const last = thread?.replies[thread.replies.length - 1];
  return (
    <Message user={user} appear={appear}>
      <MessageAvatar />
      <MessageBody>
        <MessageHeader>
          <MessageAuthor />
          {user.bot && <MessageBadge>APP</MessageBadge>}
          <MessageTimestamp>{message.time}</MessageTimestamp>
        </MessageHeader>
        <MessageContent>{message.text}</MessageContent>
        {message.reactions.length > 0 && (
          <MessageReactions>
            {message.reactions.map((r) => (
              <MessageReaction key={r.emoji} emoji={r.emoji} count={r.count} mine={r.mine} onChange={() => onToggleReaction?.(r.emoji)} />
            ))}
          </MessageReactions>
        )}
        {thread && (
          <ThreadPreview title={thread.title} count={thread.replies.length} onPress={onOpenThread}>
            {last && <ThreadPreviewReply user={users[last.user]}>{last.text}</ThreadPreviewReply>}
          </ThreadPreview>
        )}
      </MessageBody>
      <MessageActions>
        <MessageAction label="Add 👍" onPress={() => onToggleReaction?.('👍')}>
          👍
        </MessageAction>
        {onOpenThread && (
          <MessageAction label={thread ? 'Open thread' : 'Start thread'} onPress={onOpenThread}>
            <Icon name="text-bubble" size={14} sw={1.9} className="inline" />
          </MessageAction>
        )}
      </MessageActions>
    </Message>
  );
}
