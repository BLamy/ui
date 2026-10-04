import { createContext, use, type ReactNode } from 'react';
import type { AvatarProps } from '@/components/ui/avatar';
import { Icon } from '@/lib/icon';

/** A chat participant, as avatars, author names and @mentions render them. */
export interface ChatUser {
  name: string;
  /** avatar/base color */
  c: string;
  /** name label color */
  role: string;
  bot?: boolean;
}

export type ChatUsers = Record<string, ChatUser>;

/* Message text and the composer resolve `@id` mentions against the users in context. */
const ChatUsersCtx = createContext<ChatUsers>({});

export interface ChatUsersProviderProps {
  users: ChatUsers;
  children?: ReactNode;
}

export function ChatUsersProvider({ users, children }: ChatUsersProviderProps) {
  return <ChatUsersCtx.Provider value={users}>{children}</ChatUsersCtx.Provider>;
}

export function useChatUsers(): ChatUsers {
  return use(ChatUsersCtx);
}

/** The core Avatar's props for a chat user: their accent color, and a rounded square with a spark for a bot.
 *    <Avatar {...chatUserAvatar(ada, 26)} status="online" /> */
export function chatUserAvatar(user: ChatUser, size = 36): AvatarProps {
  return {
    name: user.name,
    color: user.c,
    size,
    ...(user.bot && { shape: 'square', icon: <Icon name="sparkle" size={size * 0.5} sw={2.2} /> }),
  };
}
