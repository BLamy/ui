import {
  createContext,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { AdaptivePane, collectSlots, defineSlot, useContainerWidth } from '@touchkit/ui';
import { chatTokenVars, K, KFONT } from './chat-tokens';
import { cn } from './cn';

export interface ChatShellContextValue {
  /** container width (not the viewport) */
  w: number;
  compact: boolean;
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
}

const ChatShellCtx = createContext<ChatShellContextValue | null>(null);

export function useChatShell(): ChatShellContextValue {
  const ctx = useContext(ChatShellCtx);
  if (!ctx) throw new Error('useChatShell must be used within <ChatShell>');
  return ctx;
}

export type ChatShellSlotChildren = ReactNode;

export interface ChatShellProps {
  breakpoint?: number;
  /** initial state of the compact hamburger drawer (only meaningful below the breakpoint) */
  defaultNavOpen?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/* Composition: useContainerWidth picks the width class; one AdaptivePane carries Rail + Nav as a docked
   column when wide and as a left EdgeDrawer when compact. */
export function ChatShell({
  breakpoint = 880,
  defaultNavOpen = false,
  children,
  className,
  style,
}: ChatShellProps) {
  const [ref, w] = useContainerWidth();
  const [navOpen, setNavOpen] = useState(defaultNavOpen);
  const compact = w < breakpoint;
  const ctx: ChatShellContextValue = { w, compact, navOpen, setNavOpen };
  const slots = collectSlots(children);
  return (
    <ChatShellCtx.Provider value={ctx}>
      <div
        ref={ref}
        data-slot="chat-shell"
        className={cn(className)}
        style={{
          ...chatTokenVars,
          position: 'relative',
          width: '100%',
          height: '100%',
          display: 'flex',
          background: K.bg,
          color: K.label,
          overflow: 'hidden',
          fontFamily: KFONT,
          colorScheme: 'dark',
          ...style,
        }}
      >
        <AdaptivePane
          mode={compact ? 'drawer' : 'column'}
          side="left"
          open={navOpen}
          onClose={() => setNavOpen(false)}
          scrim="rgba(0,0,0,.5)"
          columnStyle={{ display: 'flex' }}
          style={{ display: 'flex' }}
        >
          {slots.rail}
          {slots.nav}
        </AdaptivePane>
        <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex' }}>{slots.main}</div>
      </div>
    </ChatShellCtx.Provider>
  );
}

ChatShell.Rail = defineSlot('rail');
ChatShell.Nav = defineSlot('nav');
ChatShell.Main = defineSlot('main');
ChatShell.Context = ChatShellCtx;
ChatShell.useShell = useChatShell;
