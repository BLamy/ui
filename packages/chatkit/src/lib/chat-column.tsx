import type { CSSProperties, ReactNode } from 'react';
import { collectSlots, defineSlot } from '@brett_lamy/ui';
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
    <aside
      data-slot="chat-column"
      // ck-artifact-chat__chat stays as a hook for hosts that restyle the docked column.
      className={cn('ck-artifact-chat__chat z-2 flex min-h-0 min-w-0 flex-col border-r border-[color:var(--bl-sep,rgba(60,60,67,.22))] bg-[color:var(--bl-card,#fff)]', className)}
      style={style}
    >
      <div data-slot="chat-column-transcript" className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {slots.transcript}
      </div>
      <div data-slot="chat-column-composer" className="min-w-0 shrink-0">
        {slots.composer}
      </div>
    </aside>
  );
}

ChatColumn.Transcript = defineSlot('transcript');
ChatColumn.Composer = defineSlot('composer');
