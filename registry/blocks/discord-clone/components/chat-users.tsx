import { createContext, use, useMemo, type ReactNode } from 'react';
import type { AvatarProps } from '@/components/ui/avatar';
import { Icon } from '@/lib/icon';
import type { ChatPresence } from './user-panel';

/** A chat participant, as avatars, author names and @mentions render them. */
export interface ChatUser {
  name: string;
  /** avatar/base color */
  c: string;
  /** name label color */
  role: string;
  bot?: boolean;
  /** "About me" on their hover card (UserCard) */
  about?: string;
  /** "Member since" on their hover card ("Mar 4, 2024") */
  since?: string;
}

export type ChatUsers = Record<string, ChatUser>;

/* Message text and the composer resolve `@id` mentions against the users in context; hover cards (UserCard) read
   a user's @id and presence from it too. */
const ChatUsersCtx = createContext<{ users: ChatUsers; presence?: Record<string, ChatPresence> }>({ users: {} });

export interface ChatUsersProviderProps {
  users: ChatUsers;
  /** presence by id, for the dot and status line on a user's hover card */
  presence?: Record<string, ChatPresence>;
  children?: ReactNode;
}

export function ChatUsersProvider({ users, presence, children }: ChatUsersProviderProps) {
  const value = useMemo(() => ({ users, presence }), [users, presence]);
  return <ChatUsersCtx.Provider value={value}>{children}</ChatUsersCtx.Provider>;
}

export function useChatUsers(): ChatUsers {
  return use(ChatUsersCtx).users;
}

/** A user's id (their @handle) and presence, looked up in context; both undefined for a user it doesn't hold. */
export function useChatUserInfo(user: ChatUser): { id?: string; status?: ChatPresence } {
  const { users, presence } = use(ChatUsersCtx);
  const id = Object.keys(users).find((k) => users[k] === user);
  return { id, status: id ? presence?.[id] : undefined };
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
