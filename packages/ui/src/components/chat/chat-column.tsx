import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

/* ══ ChatColumn — the docked half of a chat: a transcript that scrolls above a pinned composer ══
   <ChatColumn>
     <ChatColumnTranscript>…</ChatColumnTranscript>
     <ChatColumnComposer>…</ChatColumnComposer>
   </ChatColumn>
   FloatingChat is the same pair floated over content; ArtifactChatContainer switches between the two. */

export type ChatColumnProps = ComponentProps<'aside'>;

export function ChatColumn({ className, ...props }: ChatColumnProps) {
  return (
    <aside
      data-slot="chat-column"
      // ck-artifact-chat__chat stays as a hook for hosts that restyle the docked column.
      className={cn('ck-artifact-chat__chat z-2 flex min-h-0 min-w-0 flex-col border-r border-[color:var(--border)] bg-[color:var(--card)]', className)}
      {...props}
    />
  );
}

/** The scrolling region; takes the column's remaining height. */
export function ChatColumnTranscript({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="chat-column-transcript" className={cn('flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden', className)} {...props} />;
}

/** Pinned under the transcript. */
export function ChatColumnComposer({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="chat-column-composer" className={cn('min-w-0 shrink-0', className)} {...props} />;
}
