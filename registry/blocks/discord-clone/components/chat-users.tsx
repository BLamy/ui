import { createContext, use, type ReactNode } from 'react';

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

/* RichText resolves `@id` mentions against the users in context. */
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
