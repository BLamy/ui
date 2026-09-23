import type { CSSProperties } from 'react';
import { Button } from 'react-aria-components';
import { ChatAvatar } from './chat-avatar';
import { useChatUsers, type ChatThreadData, type ChatUsers } from './chat-users';
import { cn } from './cn';
import { kvib } from './kvib';

export interface ThreadPreviewProps {
  th: ChatThreadData;
  onOpen: () => void;
  tint: string;
  users?: ChatUsers;
  className?: string;
  style?: CSSProperties;
}

export function ThreadPreview({ th, onOpen, tint, users, className, style }: ThreadPreviewProps) {
  const ctxUsers = useChatUsers();
  const map = users ?? ctxUsers;
  const last = th.msgs[th.msgs.length - 1];
  return (
    <Button
      data-slot="thread-preview"
      className={cn(
        'mt-[7px] block w-full max-w-[520px] cursor-pointer rounded-[10px] border border-ck-sep bg-ck-card px-[11px] py-[8px] text-left font-ios',
        className,
      )}
      onPress={() => {
        kvib([6]);
        onOpen();
      }}
      style={{ '--ck-tint': tint, ...style } as CSSProperties}
    >
      <span className="flex items-center gap-[7px] text-[12.5px]">
        <span className="font-[650] text-ck-label">{th.title}</span>
        <span className="font-semibold whitespace-nowrap text-(--ck-tint)">
          {th.msgs.length} {th.msgs.length === 1 ? 'message' : 'messages'} ›
        </span>
      </span>
      {last && (
        <span className="mt-[4px] flex min-w-0 items-center gap-[6px] text-[12px] text-ck-mut">
          <ChatAvatar user={map[last.u]} size={15} />
          <span className="truncate">
            {map[last.u].name}: {last.txt}
          </span>
        </span>
      )}
    </Button>
  );
}
