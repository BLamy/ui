import type { CSSProperties } from 'react';
import { ChatAvatar } from './chat-avatar';
import { K, KFONT } from './chat-tokens';
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
    <button
      data-slot="thread-preview"
      className={cn(className)}
      onClick={() => {
        kvib([6]);
        onOpen();
      }}
      style={{
        display: 'block',
        width: '100%',
        maxWidth: 520,
        textAlign: 'left',
        marginTop: 7,
        cursor: 'pointer',
        background: K.card,
        border: '1px solid ' + K.sep,
        borderRadius: 10,
        padding: '8px 11px',
        fontFamily: KFONT,
        ...style,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
        <span style={{ fontWeight: 650, color: K.label }}>{th.title}</span>
        <span style={{ color: tint, fontWeight: 600, whiteSpace: 'nowrap' }}>
          {th.msgs.length} {th.msgs.length === 1 ? 'message' : 'messages'} ›
        </span>
      </span>
      {last && (
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
            fontSize: 12,
            color: K.mut,
            minWidth: 0,
          }}
        >
          <ChatAvatar user={map[last.u]} size={15} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {map[last.u].name}: {last.txt}
          </span>
        </span>
      )}
    </button>
  );
}
