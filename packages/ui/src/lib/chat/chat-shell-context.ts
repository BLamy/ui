import { createContext, useContext } from 'react';

export interface ChatShellContextValue {
  /** measured width of the shell (the container, not the viewport) */
  width: number;
  /** `width < breakpoint`: the navigation lives in a drawer */
  compact: boolean;
  /** compact navigation drawer visibility */
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
  /** a ChatShellNav is mounted (so ChatShellNavTrigger has something to open) */
  hasNav: boolean;
  /** called by ChatShellNav on mount; returns its unregister */
  registerNav: () => () => void;
}

export const ChatShellContext = createContext<ChatShellContextValue | null>(null);

/** Shell state for anything rendered inside `<ChatShell>`. Throws outside one. */
export function useChatShell(): ChatShellContextValue {
  const ctx = useContext(ChatShellContext);
  if (!ctx) throw new Error('useChatShell must be used within <ChatShell>');
  return ctx;
}

/** The same, or null outside a shell — for parts that also render standalone (ServerHeader, ChannelItem…). */
export function useOptionalChatShell(): ChatShellContextValue | null {
  return useContext(ChatShellContext);
}
