import { createContext, useContext } from 'react';
import type { AdaptivePaneController, AdaptivePaneOpenChangeDetails } from '@/components/ui/adaptive-pane';

/** Why the compact navigation drawer opened or closed: the AdaptivePane's own details (Escape, the scrim, a swipe…),
    `trigger-press` from ChatShellNavTrigger, or `imperative` from code. */
export type ChatShellNavOpenChangeDetails = AdaptivePaneOpenChangeDetails;

export interface ChatShellContextValue {
  /** measured width of the shell (the container, not the viewport) */
  width: number;
  /** `width < breakpoint`: the navigation lives in a drawer */
  compact: boolean;
  /** compact navigation drawer visibility */
  navOpen: boolean;
  /** Opens or closes it: tells `onNavOpenChange` first with `details` (default reason `imperative`) and moves only if
      it wasn't canceled. Returns whether it moved. */
  setNavOpen: (open: boolean, details?: ChatShellNavOpenChangeDetails) => boolean;
  /** a ChatShellNav is mounted (so ChatShellNavTrigger has something to open) */
  hasNav: boolean;
  /** called by ChatShellNav on mount; returns its unregister */
  registerNav: () => () => void;
  /** The navigation pane's controller, which ChatShellNavTrigger (an AdaptivePaneTrigger) opens it through. */
  navPane: AdaptivePaneController;
}

export const ChatShellContext = createContext<ChatShellContextValue | null>(null);

/** Shell state for anything rendered inside `<ChatShell>`. Throws outside one. */
export function useChatShell(): ChatShellContextValue {
  const ctx = useContext(ChatShellContext);
  if (!ctx) throw new Error('useChatShell must be used within <ChatShell>');
  return ctx;
}

/** The same, or null outside a shell — for parts that also render standalone (a channel row that closes the
 *  compact drawer when it is inside a shell). */
export function useOptionalChatShell(): ChatShellContextValue | null {
  return useContext(ChatShellContext);
}
