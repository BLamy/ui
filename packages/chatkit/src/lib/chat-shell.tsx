import {
  createContext,
  useContext,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { AdaptivePane, collectSlots, defineSlot, useAppearance, useContainerWidth, type Appearance } from '@brett_lamy/ui';
import { chatVars } from './chat-tokens';
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

const columnStyle: CSSProperties = { display: 'flex' };

export interface ChatShellProps {
  breakpoint?: number;
  /** initial state of the compact hamburger drawer (only meaningful below the breakpoint) */
  defaultNavOpen?: boolean;
  /** Light or dark palette. Defaults to the ambient `AppearanceProvider` value, else dark. */
  appearance?: Appearance;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/* Composition: useContainerWidth picks the width class; one AdaptivePane carries Rail + Nav as a docked
   column when wide and as a left EdgeDrawer when compact. */
export function ChatShell({
  breakpoint = 880,
  defaultNavOpen = false,
  appearance: appearanceProp,
  children,
  className,
  style,
}: ChatShellProps) {
  const [ref, w] = useContainerWidth();
  const [navOpen, setNavOpen] = useState(defaultNavOpen);
  const ambient = useAppearance();
  const appearance = appearanceProp ?? ambient ?? 'dark';
  const compact = w < breakpoint;
  const ctx: ChatShellContextValue = { w, compact, navOpen, setNavOpen };
  const slots = collectSlots(children);
  return (
    <ChatShellCtx.Provider value={ctx}>
      <div
        ref={ref}
        data-slot="chat-shell"
        data-appearance={appearance}
        className={cn(
          'relative flex h-full w-full overflow-hidden bg-ck-bg font-ios text-ck-label',
          appearance === 'light' ? '[color-scheme:light]' : '[color-scheme:dark]',
          className,
        )}
        // The chat tokens as --ck-* custom properties, for anything rendered inside the shell.
        style={{ ...chatVars(appearance), ...style }}
      >
        <AdaptivePane
          mode={compact ? 'drawer' : 'column'}
          side="left"
          open={navOpen}
          onClose={() => setNavOpen(false)}
          scrim="var(--ck-scrim, rgba(0,0,0,.5))"
          // AdaptivePane's docked column only takes a style object.
          columnStyle={columnStyle}
          className="flex"
        >
          {slots.rail}
          {slots.nav}
        </AdaptivePane>
        <div className="flex min-h-0 min-w-0 flex-1">{slots.main}</div>
      </div>
    </ChatShellCtx.Provider>
  );
}

ChatShell.Rail = defineSlot('rail');
ChatShell.Nav = defineSlot('nav');
ChatShell.Main = defineSlot('main');
ChatShell.Context = ChatShellCtx;
ChatShell.useShell = useChatShell;
