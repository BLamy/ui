import type { CSSProperties } from 'react';
import { ChatShellFooter, cn } from '@brett_lamy/ui';
import { ChatComposer } from './components/chat-composer';
import { useChatUsers } from './components/chat-users';
import { MessageDivider, MessageList, MessageListEmpty } from './components/message-list';
import { ThreadHeader } from './components/thread-preview';
import { ChannelMessage } from './channel-message';
import type { MessageData } from './data';

export interface ThreadViewProps {
  /** the message the thread hangs off (must have a `thread`) */
  message: MessageData;
  channelName: string;
  /** `panel` beside the channel, or `full` in place of it */
  mode: 'panel' | 'full';
  onToggleReaction: (emoji: string) => void;
  onReply: (text: string) => void;
}

/** An open thread: its root message, the replies, and a reply composer. */
export function ThreadView({ message, channelName, mode, onToggleReaction, onReply }: ThreadViewProps) {
  const users = useChatUsers();
  const author = users[message.user];
  const thread = message.thread!;
  const n = thread.replies.length;
  return (
    <div className={cn('mx-auto box-border flex h-full w-full flex-col font-ios', mode === 'full' ? 'max-w-[760px]' : 'max-w-none')}>
      <MessageList className="pt-1 pb-2.5">
        {mode === 'panel' && (
          <ThreadHeader
            title={thread.title}
            // One line: splitting the surrounding text into more nodes shifts its kerning.
            description={<>Started by <span className="ck-role font-semibold text-[color:var(--ck-role)]" style={{ '--ck-role': author.role } as CSSProperties}>{author.name}</span> in #{channelName}</>}
          />
        )}
        <div className="px-1 pt-2.5">
          <ChannelMessage message={{ ...message, thread: null }} onToggleReaction={onToggleReaction} />
          {n > 0 && (
            <MessageDivider>
              {n} {n === 1 ? 'reply' : 'replies'}
            </MessageDivider>
          )}
          {thread.replies.map((reply) => (
            <ChannelMessage key={reply.id} message={{ ...reply, reactions: [] }} appear />
          ))}
          {n === 0 && <MessageListEmpty>No replies yet — say something.</MessageListEmpty>}
        </div>
      </MessageList>
      <ChatShellFooter className="px-3">
        <ChatComposer placeholder={'Reply in "' + thread.title + '"'} onSend={onReply} autoFocus={mode === 'panel'} />
      </ChatShellFooter>
    </div>
  );
}
