import { useCallback, useLayoutEffect, useMemo, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  AdaptivePane, AdaptivePaneClose, AdaptivePaneHeader, AdaptivePaneTitle, adaptivePanePageClass, type AdaptivePaneOpenChangeDetails,
} from '@/components/ui/adaptive-pane';
import { Button as SdkButton } from '@ui-sdk/react/button';
import { Toggle as SdkToggle } from '@ui-sdk/react/toggle';
import { changeDetails } from '@/lib/change-details';
import { SizeClassProvider, useContainerWidth, useSizeClassScope } from '@/lib/container';
import { sizeClassOf } from '@/lib/size-class';
import { Icon } from '@/lib/icon';
import { ThemeScopeContext, useAppearance, themeScopeProps, type Appearance } from '@/lib/theme';
import { cn, cx } from '@/lib/utils';

import { ChatShellContext, useChatShell, useOptionalChatShell, type ChatShellContextValue, type ChatShellNavOpenChangeDetails } from './chat-shell-context';

export { useChatShell, useOptionalChatShell, type ChatShellContextValue, type ChatShellNavOpenChangeDetails };

/* ══ ChatShell — the layout root of a team chat, and its regions ══
   <ChatShell>                     measures itself, provides { width, compact, navOpen } and a size-class scope, applies --ck-* tokens
     <ChatShellNav>                rail + sidebar: a docked column when wide, a left drawer when compact
       <Tabs variant="workspace"><TabsBar>…   an optional workspace rail
       <ChatShellSidebar>…         the channel column (header · channel list · signed-in user)
     <ChatShellMain>               the conversation column
       <ChatShellHeader>…          NavTrigger · HeaderIcon · Title · Description · HeaderActions
       …                           the transcript (e.g. a scrolling `role="log"` region)
       <ChatShellFooter>…          composer
     <ChatShellAside>              docked member list, shown from `minWidth` up
     <ChatShellPanel>              thread panel: docks as a column from `dockWidth`, overlays below it
   Every region is an ordinary element — leave out what you don't need (a DM view has no rail; a support
   widget has no nav at all). Responsive behaviour comes from AdaptivePane. The Discord-style
   channel, message and member parts live in the discord-clone registry block. */

export interface ChatShellProps extends Omit<ComponentProps<'div'>, 'ref'> {
  /** container width below which the navigation moves into a drawer */
  breakpoint?: number;
  /** initial state of the compact navigation drawer */
  defaultNavOpen?: boolean;
  /** controlled compact navigation drawer */
  navOpen?: boolean;
  /** Runs before the drawer opens or closes, with why; `details.cancel()` keeps it as it is. */
  onNavOpenChange?: (open: boolean, details: ChatShellNavOpenChangeDetails) => void;
  /** Light or dark palette. Defaults to the ambient `AppearanceProvider` value, else dark. */
  appearance?: Appearance;
  /** accent for unread dots, mention pills, own reactions, the send button (--primary). Defaults to the theme primary. */
  tint?: string;
}

export function ChatShell({
  breakpoint = 880,
  defaultNavOpen = false,
  navOpen: navOpenProp,
  onNavOpenChange,
  appearance: appearanceProp,
  tint,
  children,
  className,
  style,
  ...props
}: ChatShellProps) {
  const [ref, width] = useContainerWidth();
  const [navOpenState, setNavOpenState] = useState(defaultNavOpen);
  const navOpen = navOpenProp ?? navOpenState;
  // The consumer hears the change first, with the AdaptivePane's details (or the caller's); a cancel keeps it.
  const setNavOpen = (open: boolean, details: ChatShellNavOpenChangeDetails = changeDetails({ reason: 'imperative' })) => {
    onNavOpenChange?.(open, details);
    if (details.canceled) return false;
    setNavOpenState(open);
    return true;
  };
  const ambient = useAppearance();
  const appearance = appearanceProp ?? ambient ?? 'dark';
  const [navs, setNavs] = useState(0);
  const registerNav = useCallback(() => {
    setNavs((n) => n + 1);
    return () => setNavs((n) => n - 1);
  }, []);
  // Compact below `breakpoint`; the shell is a size-class scope, so popups inside (dialogs, menus with
  // `presentation="auto"`) and its own navigation follow its box. Its pixel width answers the docking questions.
  const sizeClass = sizeClassOf(width, { medium: breakpoint, regular: Math.max(breakpoint, 1024) });
  const ctx: ChatShellContextValue = { width, compact: sizeClass === 'compact', navOpen, setNavOpen, hasNav: navs > 0, registerNav };
  const scope = themeScopeProps({ scope: 'chat', appearance, tint });
  // Published too, so overlays opened inside (hover cards, menus) portal out wearing the same chat scope.
  const scopeState = useMemo(() => ({ scope: 'chat' as const, appearance, tint }), [appearance, tint]);
  return (
    <ThemeScopeContext.Provider value={scopeState}>
      <ChatShellContext.Provider value={ctx}>
        <div
          ref={ref}
          data-slot="chat-shell"
          data-appearance={appearance}
          data-size-class={sizeClass}
          // A `chat` theme scope: the bl-theme's team-chat palette for everything inside the shell.
          data-theme-scope={scope['data-theme-scope']}
          className={cn('relative flex h-full w-full overflow-hidden bg-background font-sans text-foreground', scope.className, className)}
          style={{ ...scope.style, ...style }}
          {...props}
        >
          <SizeClassProvider value={sizeClass}>{children}</SizeClassProvider>
        </div>
      </ChatShellContext.Provider>
    </ThemeScopeContext.Provider>
  );
}

/* ── Navigation: rail + sidebar, docked or in a drawer ── */

export interface ChatShellNavProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Holds the rail and the sidebar. Wide: a docked column. Compact: a left drawer over a scrim, opened by
 *  `ChatShellNavTrigger` and closed by the scrim or by anything that calls `useChatShell().setNavOpen(false)` (a close button, picking a
 *  channel). */
export function ChatShellNav({ children, className, style }: ChatShellNavProps) {
  const { navOpen, setNavOpen, registerNav } = useChatShell();
  const compact = useSizeClassScope() === 'compact';
  useLayoutEffect(registerNav, [registerNav]);
  return (
    <AdaptivePane
      presentation={compact ? 'drawer' : 'column'}
      side="left"
      aria-label="Navigation"
      // Docked, the navigation always shows; compact, it is the drawer's state.
      open={!compact || navOpen}
      onOpenChange={(next, details) => { if (!setNavOpen(next, details)) details.cancel(); }}
      // The rail and the sidebar sit side by side, as wide as they are.
      drawerWidth="auto"
      className={cn('flex-row', className)}
      style={style}
    >
      {children}
    </AdaptivePane>
  );
}

export interface ChatShellNavTriggerProps extends Omit<ComponentProps<typeof SdkButton>, 'children'> {
  children?: ReactNode;
}

/** The hamburger that opens the navigation drawer. Renders nothing while the navigation is docked (or when
 *  the shell has no ChatShellNav). */
export function ChatShellNavTrigger({ className, children, onClick, ...props }: ChatShellNavTriggerProps) {
  const { compact, hasNav, navOpen, setNavOpen } = useChatShell();
  if (!compact || !hasNav) return null;
  return (
    <SdkButton
      aria-label="Channels"
      aria-expanded={navOpen}
      onClick={(e, details) => {
        onClick?.(e, details);
        if (!e.defaultPrevented) setNavOpen(true, changeDetails({ reason: 'trigger-press', event: e.nativeEvent }));
      }}
      className={cx('grid cursor-pointer border-0 bg-transparent p-1 text-muted-foreground', className)}
      {...props}
    >
      {children ?? <Icon name="line-3-horizontal" size={17} sw={2} />}
    </SdkButton>
  );
}

/** The channel column: a 222px sidebar surface (a header, the channel list, the signed-in user). */
export function ChatShellSidebar({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="chat-shell-sidebar"
      className={cn('box-border flex h-full w-[222px] shrink-0 flex-col border-r border-border bg-sidebar font-sans [--avatar-ring:var(--sidebar)]', className)}
      {...props}
    />
  );
}

/* ── Main column ── */

/** The conversation column: header, transcript, footer. Takes the remaining width. */
export function ChatShellMain({ className, ...props }: ComponentProps<'div'>) {
  // The conversation is the page a ChatShellPanel pushes over on a phone: it parallaxes under the push.
  return <div data-slot="chat-shell-main" className={cn('flex min-w-0 flex-1 flex-col', adaptivePanePageClass, className)} {...props} />;
}

export function ChatShellHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="chat-shell-header"
      className={cn('box-border flex h-toolbar shrink-0 items-center gap-[9px] border-b border-border px-4', className)}
      {...props}
    />
  );
}

/** Leading glyph of the header; a # by default. */
export function ChatShellHeaderIcon({ className, children, ...props }: ComponentProps<'span'>) {
  return (
    <span data-slot="chat-shell-header-icon" className={cn('grid text-tertiary-foreground', className)} {...props}>
      {children ?? <Icon name="number" size={15} sw={2.2} />}
    </span>
  );
}

export function ChatShellTitle({ className, ...props }: ComponentProps<'span'>) {
  return <span data-slot="chat-shell-title" className={cn('min-w-0 truncate text-detail font-[750]', className)} {...props} />;
}

/** The channel topic; fills the space between the title and the actions. */
export function ChatShellDescription({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      data-slot="chat-shell-description"
      className={cn('flex-1 overflow-hidden text-[11.5px] text-ellipsis whitespace-nowrap text-tertiary-foreground', className)}
      {...props}
    />
  );
}

/** Trailing header actions, pushed to the end. */
export function ChatShellHeaderActions({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="chat-shell-header-actions" className={cn('ms-auto flex shrink-0 items-center gap-[9px]', className)} {...props} />;
}

export const chatShellHeaderActionVariants = cva('shrink-0 cursor-pointer bg-transparent font-sans', {
  variants: {
    variant: {
      /** an icon button (a pressed ChatShellHeaderToggle is tinted) */
      icon: 'grid border-0 p-1 text-tertiary-foreground hover:text-muted-foreground data-pressed:text-primary',
      /** a small outlined text button */
      outline: 'rounded-lg border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground hover:bg-accent',
    },
  },
  defaultVariants: { variant: 'icon' },
});

export interface ChatShellHeaderActionProps
  extends ComponentProps<typeof SdkButton>,
    VariantProps<typeof chatShellHeaderActionVariants> {}

/** A header action: an icon (`variant="icon"`) or a small outlined text button (`"outline"`). */
export function ChatShellHeaderAction({ variant, className, ...props }: ChatShellHeaderActionProps) {
  return <SdkButton className={cx(chatShellHeaderActionVariants({ variant }), className)} {...props} />;
}

export interface ChatShellHeaderToggleProps
  extends ComponentProps<typeof SdkToggle>,
    VariantProps<typeof chatShellHeaderActionVariants> {}

/** A header action that stays on (the member list, a thread panel): UI SDK's Toggle, `pressed` /
 *  `onPressedChange(pressed, details)`; the icon variant tints while pressed. */
export function ChatShellHeaderToggle({ variant, className, ...props }: ChatShellHeaderToggleProps) {
  return <SdkToggle className={cx(chatShellHeaderActionVariants({ variant }), className)} {...props} />;
}

export interface ChatShellBackProps extends Omit<ComponentProps<typeof SdkButton>, 'children'> {
  children?: ReactNode;
}

/** A tinted "‹ #channel" back button, for a view (a full-width thread) that replaces the channel. */
export function ChatShellBack({ className, children, ...props }: ChatShellBackProps) {
  return (
    <SdkButton
      className={cx('flex shrink-0 cursor-pointer items-center gap-1 border-0 bg-transparent py-1 pr-1.5 pl-0 font-sans text-footnote font-[650] text-primary', className)}
      {...props}
    >
      <Icon name="chevron-right-compact" size={13} sw={1.9} className="rotate-180" />
      {children}
    </SdkButton>
  );
}

/** Pins the composer (and anything else) under the transcript. */
export function ChatShellFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="chat-shell-footer" className={cn('shrink-0 px-3.5 pb-3', className)} {...props} />;
}

/* ── Side regions ── */

export interface ChatShellAsideProps extends ComponentProps<'aside'> {
  /** the aside only docks when the shell is at least this wide */
  minWidth?: number;
  /** set false to hide it at any width (a member-list toggle, or while a thread panel is open) */
  open?: boolean;
}

/** A docked trailing column (the member list). It steps aside below `minWidth` rather than squeezing the
 *  conversation. */
export function ChatShellAside({ minWidth = 1320, open = true, className, ...props }: ChatShellAsideProps) {
  const { width } = useChatShell();
  if (!open || width < minWidth) return null;
  return (
    <aside
      data-slot="chat-shell-aside"
      className={cn('box-border w-[168px] shrink-0 border-l border-border bg-sidebar [--avatar-ring:var(--sidebar)]', className)}
      {...props}
    />
  );
}

export interface ChatShellPanelProps {
  open: boolean;
  /** The AdaptivePane's own change details (the close button, Escape, a swipe…); `details.cancel()` keeps it open. */
  onOpenChange?: (open: boolean, details: AdaptivePaneOpenChangeDetails) => void;
  title?: ReactNode;
  /** from this shell width up the panel docks as a column; below it, it overlays the conversation */
  dockWidth?: number;
  /** panel width; defaults to min(360, shell width − 60) */
  width?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** A trailing panel for a thread (or details): an AdaptivePane that docks beside the conversation on wide shells,
 *  slides over it below `dockWidth`, and is pushed over it like a page on a compact shell. */
export function ChatShellPanel({ open, onOpenChange, title = 'Thread', dockWidth = 1180, width, children, className, style }: ChatShellPanelProps) {
  const { width: w, compact } = useChatShell();
  const size = width ?? Math.min(360, w - 60);
  return (
    <AdaptivePane
      side="end"
      presentation={w >= dockWidth ? 'column' : compact ? 'push' : 'drawer'}
      open={open}
      onOpenChange={onOpenChange}
      columnWidth={size}
      drawerWidth={`min(${size}px, 88%)`}
      // Inside the chat scope the pane already paints with the chat palette; its close button takes the stronger fill.
      className={({ presentation }) => cn(
        '[--secondary:var(--secondary-strong,var(--accent))]',
        presentation === 'column' && 'border-s border-border bg-background',
        className,
      )}
      style={style}
    >
      <AdaptivePaneHeader>
        <AdaptivePaneTitle>{title}</AdaptivePaneTitle>
        <AdaptivePaneClose />
      </AdaptivePaneHeader>
      <div data-slot="chat-shell-panel" className="bl-scroll box-border min-h-0 flex-1 overflow-y-auto">
        {children}
      </div>
    </AdaptivePane>
  );
}
