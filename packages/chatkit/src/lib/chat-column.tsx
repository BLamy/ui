import type { CSSProperties, ReactNode } from 'react';
import { collectSlots, defineSlot } from '@touchkit/ui';
import { cn } from './cn';

/* ══ ChatColumn — the docked half of a chat: a transcript that scrolls above a pinned composer ══
   FloatingChat is the same pair floated over content; ArtifactChatContainer switches between the two. */

export interface ChatColumnProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export function ChatColumn({ children, className, style }: ChatColumnProps) {
  const slots = collectSlots(children);
  return (
    <aside data-slot="chat-column" className={cn('ck-artifact-chat__chat', className)} style={style}>
      <div className="ck-artifact-chat__transcript">{slots.transcript}</div>
      <div className="ck-artifact-chat__composer">{slots.composer}</div>
    </aside>
  );
}

ChatColumn.Transcript = defineSlot('transcript');
ChatColumn.Composer = defineSlot('composer');
