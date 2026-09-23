import type { CSSProperties } from 'react';
import { ChatIcon, chatIconPaths } from './chat-icon';
import type { ChatUser } from './chat-users';
import { cn } from './cn';

export interface ChatAvatarProps {
  user: ChatUser;
  size?: number;
  square?: boolean;
  className?: string;
  style?: CSSProperties;
}

/** Initial (or bot spark) on a diagonal gradient of the user's color. Size and color arrive as CSS variables. */
export function ChatAvatar({ user, size = 36, square, className, style }: ChatAvatarProps) {
  return (
    <span
      data-slot="chat-avatar"
      className={cn(
        'grid size-(--ck-avatar-size) shrink-0 place-items-center bg-(image:--ck-avatar-bg) font-ios text-(length:--ck-avatar-font) font-extrabold text-white',
        square ? 'rounded-(--ck-avatar-radius)' : 'rounded-[50%]',
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
    </span>
  );
}
