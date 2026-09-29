import type { CSSProperties } from 'react';
import { Icon } from '../../lib/icon';
import type { ChatUser } from '../../lib/chat/chat-users';
import { cn } from '../../lib/utils';
import { cva } from 'class-variance-authority';

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
export const chatAvatarVariants = cva(
  'grid size-(--ck-avatar-size) shrink-0 place-items-center bg-(image:--ck-avatar-bg) font-ios text-(length:--ck-avatar-font) font-extrabold text-white',
  {
    variants: {
      /** A rounded square (bots) instead of a circle. */
      square: { true: 'rounded-(--ck-avatar-radius)', false: 'rounded-[50%]' },
    },
    defaultVariants: { square: false },
  },
);

/** The presence dot, ringed in the surface colour. */
export const chatAvatarStatusVariants = cva(
  'absolute -right-[2px] -bottom-[2px] box-border size-[max(10px,calc(var(--ck-avatar-size)*.36))] rounded-full border-[2.5px] border-(--ck-avatar-ring,var(--background))',
  {
    variants: {
      status: { online: 'bg-success', idle: 'bg-warning', dnd: 'bg-destructive', offline: 'bg-tertiary-foreground' },
    },
    defaultVariants: { status: 'online' },
  },
);

export function ChatAvatar({ user, size = 36, square, status, className, style }: ChatAvatarProps) {
  return (
    <span
      data-slot="chat-avatar"
      className={cn(chatAvatarVariants({ square: !!square }), status && 'relative', className)}
      style={{
        '--ck-avatar-size': `${size}px`,
        '--ck-avatar-font': `${size * 0.42}px`,
        '--ck-avatar-radius': `${size * 0.3}px`,
        '--ck-avatar-bg': `linear-gradient(135deg, ${user.c}, ${user.c}88)`,
        ...style,
      } as CSSProperties}
    >
      {user.bot ? <Icon name="sparkle" size={size * 0.5} sw={2.2} /> : user.name[0]}
      {status && (
        <span
          data-slot="chat-avatar-status"
          data-status={status}
          aria-label={status}
          className={chatAvatarStatusVariants({ status })}
        />
      )}
    </span>
  );
}
