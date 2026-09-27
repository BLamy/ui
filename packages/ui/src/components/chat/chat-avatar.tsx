import type { CSSProperties } from 'react';
import { ChatIcon, chatIconPaths } from '../../lib/chat/chat-icon';
import type { ChatUser } from '../../lib/chat/chat-users';
import { cn } from '../../lib/utils';

export interface ChatAvatarProps {
  user: ChatUser;
  size?: number;
  square?: boolean;
  /** presence dot on the lower-right; ringed in `--ck-avatar-ring` (the surface it sits on: ChatShell regions set it) */
  status?: 'online' | 'idle' | 'dnd' | 'offline';
  className?: string;
  style?: CSSProperties;
}

/** Initial (or bot spark) on a diagonal gradient of the user's color. Size and color arrive as CSS variables. */
const statusColor = {
  online: 'bg-ck-green',
  idle: 'bg-ck-orange',
  dnd: 'bg-ck-red',
  offline: 'bg-ck-mut3',
} as const;

export function ChatAvatar({ user, size = 36, square, status, className, style }: ChatAvatarProps) {
  return (
    <span
      data-slot="chat-avatar"
      className={cn(
        'grid size-(--ck-avatar-size) shrink-0 place-items-center bg-(image:--ck-avatar-bg) font-ios text-(length:--ck-avatar-font) font-extrabold text-white',
        square ? 'rounded-(--ck-avatar-radius)' : 'rounded-[50%]',
        status && 'relative',
        className,
      )}
      style={{
        '--ck-avatar-size': `${size}px`,
        '--ck-avatar-font': `${size * 0.42}px`,
        '--ck-avatar-radius': `${size * 0.3}px`,
        '--ck-avatar-bg': `linear-gradient(135deg, ${user.c}, ${user.c}88)`,
        ...style,
      } as CSSProperties}
    >
      {user.bot ? <ChatIcon d={chatIconPaths.spark} size={size * 0.5} sw={2.2} /> : user.name[0]}
      {status && (
        <span
          data-slot="chat-avatar-status"
          data-status={status}
          aria-label={status}
          className={cn(
            'absolute -right-[2px] -bottom-[2px] box-border size-[max(10px,calc(var(--ck-avatar-size)*.36))] rounded-full border-[2.5px] border-(--ck-avatar-ring,var(--ck-bg,#131318))',
            statusColor[status],
          )}
        />
      )}
    </span>
  );
}
