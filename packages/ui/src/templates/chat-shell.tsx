import { useCallback, useLayoutEffect, useState, type ComponentProps, type CSSProperties, type ReactNode } from 'react';
import { Button, composeRenderProps } from 'react-aria-components';
import { cva, type VariantProps } from 'class-variance-authority';
import { AdaptivePane } from '../components/adaptive-pane';
import { SideDrawer } from '../components/side-drawer';
import { useContainerWidth } from '../lib/container';
import { useAppearance, themeScopeProps, type Appearance } from '../lib/theme';
import { Icon } from '../lib/icon';
import { ChatShellContext, useChatShell, useOptionalChatShell, type ChatShellContextValue } from '../lib/chat/chat-shell-context';
import { cn } from '../lib/utils';

export { useChatShell, useOptionalChatShell, type ChatShellContextValue };

/* ══ ChatShell — the layout root of a team chat, and its regions ══
   <ChatShell>                     measures itself, provides { width, compact, navOpen }, applies --ck-* tokens
     <ChatShellNav>                rail + sidebar: a docked column when wide, one left EdgeDrawer when compact
       <TabView orientation="vertical"><TabViewBar variant="workspace">…   an optional workspace rail
       <ChatShellSidebar>…         the channel column (header · channel list · signed-in user)
     <ChatShellMain>               the conversation column
       <ChatShellHeader>…          NavTrigger · HeaderIcon · Title · Description · HeaderActions
       …                           the transcript (e.g. a scrolling `role="log"` region)
       <ChatShellFooter>…          composer
     <ChatShellAside>              docked member list, shown from `minWidth` up
     <ChatShellPanel>              thread panel: docks as a column from `dockWidth`, overlays below it
   Every region is an ordinary element — leave out what you don't need (a DM view has no rail; a support
   widget has no nav at all). Responsive behaviour comes from AdaptivePane and SideDrawer. The Discord-style
   channel, message and member parts live in the discord-clone registry block. */

export interface ChatShellProps extends Omit<ComponentProps<'div'>, 'ref'> {
  /** container width below which the navigation moves into a drawer */
  breakpoint?: number;
  /** initial state of the compact navigation drawer */
  defaultNavOpen?: boolean;
  /** controlled compact navigation drawer */
  navOpen?: boolean;
  onNavOpenChange?: (open: boolean) => void;
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
  const setNavOpen = (open: boolean) => {
    setNavOpenState(open);
    onNavOpenChange?.(open);
  };
  const ambient = useAppearance();
  const appearance = appearanceProp ?? ambient ?? 'dark';
  const [navs, setNavs] = useState(0);
  const registerNav = useCallback(() => {
    setNavs((n) => n + 1);
    return () => setNavs((n) => n - 1);
  }, []);
  const ctx: ChatShellContextValue = { width, compact: width < breakpoint, navOpen, setNavOpen, hasNav: navs > 0, registerNav };
  const scope = themeScopeProps({ scope: 'chat', appearance, tint });
  return (
    <ChatShellContext.Provider value={ctx}>
      <div
        ref={ref}
        data-slot="chat-shell"
        data-appearance={appearance}
        data-compact={ctx.compact || undefined}
        // A `chat` theme scope: the bl-theme's team-chat palette for everything inside the shell.
        data-theme-scope={scope['data-theme-scope']}
        className={cn('relative flex h-full w-full overflow-hidden bg-background font-ios text-foreground', scope.className, className)}
        style={{ ...scope.style, ...style }}
        {...props}
      >
        {children}
      </div>
    </ChatShellContext.Provider>
  );
}

/* ── Navigation: rail + sidebar, docked or in a drawer ── */

// AdaptivePane's docked column only takes a style object.
const navColumnStyle: CSSProperties = { display: 'flex' };

export interface ChatShellNavProps {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** Holds the rail and the sidebar. Wide: a docked column. Compact: a left EdgeDrawer over a scrim, opened by
 *  `ChatShellNavTrigger` and closed by the scrim or by anything that calls `useChatShell().setNavOpen(false)` (a close button, picking a
 *  channel). */
export function ChatShellNav({ children, className, style }: ChatShellNavProps) {
  const { compact, navOpen, setNavOpen, registerNav } = useChatShell();
  useLayoutEffect(registerNav, [registerNav]);
  return (
    <AdaptivePane
      mode={compact ? 'drawer' : 'column'}
      side="left"
      open={navOpen}
      onClose={() => setNavOpen(false)}
      scrim="var(--overlay, color-mix(in oklab, black 40%, transparent))"
      columnStyle={{ ...navColumnStyle, ...style }}
      className={cn('flex', className)}
    >
      {children}
    </AdaptivePane>
  );
}

export interface ChatShellNavTriggerProps extends Omit<ComponentProps<typeof Button>, 'children'> {
  children?: ReactNode;
}

/** The hamburger that opens the navigation drawer. Renders nothing while the navigation is docked (or when
 *  the shell has no ChatShellNav). */
export function ChatShellNavTrigger({ className, children, onPress, ...props }: ChatShellNavTriggerProps) {
  const { compact, hasNav, setNavOpen } = useChatShell();
  if (!compact || !hasNav) return null;
  return (
    <Button
      data-slot="chat-shell-nav-trigger"
      aria-label="Channels"
      onPress={(e) => {
        setNavOpen(true);
        onPress?.(e);
      }}
      className={composeRenderProps(className, (c) => cn('grid cursor-pointer border-0 bg-transparent p-1 text-muted-foreground', c))}
      {...props}
    >
      {children ?? <Icon name="line-3-horizontal" size={17} sw={2} />}
    </Button>
  );
}

/** The channel column: a 222px sidebar surface (a header, the channel list, the signed-in user). */
export function ChatShellSidebar({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="chat-shell-sidebar"
      className={cn('box-border flex h-full w-[222px] shrink-0 flex-col border-r border-border bg-sidebar font-ios [--ck-avatar-ring:var(--sidebar)]', className)}
      {...props}
    />
  );
}

/* ── Main column ── */

/** The conversation column: header, transcript, footer. Takes the remaining width. */
export function ChatShellMain({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="chat-shell-main" className={cn('flex min-w-0 flex-1 flex-col', className)} {...props} />;
}

export function ChatShellHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="chat-shell-header"
      className={cn('flex h-[46px] shrink-0 items-center gap-[9px] border-b border-border px-4', className)}
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
  return <span data-slot="chat-shell-title" className={cn('min-w-0 truncate text-[14px] font-[750]', className)} {...props} />;
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

export const chatShellHeaderActionVariants = cva('shrink-0 cursor-pointer bg-transparent font-ios', {
  variants: {
    variant: {
      /** an icon button; `isActive` tints it */
      icon: 'grid border-0 p-1 text-tertiary-foreground data-hovered:text-muted-foreground data-[active]:text-primary',
      /** a small outlined text button */
      outline: 'rounded-[8px] border border-border px-2.5 py-1 text-[11.5px] font-semibold text-muted-foreground data-hovered:bg-accent',
    },
  },
  defaultVariants: { variant: 'icon' },
});

export interface ChatShellHeaderActionProps
  extends ComponentProps<typeof Button>,
    VariantProps<typeof chatShellHeaderActionVariants> {
  /** marks a toggle as on (tints the icon variant) */
  isActive?: boolean;
}

export function ChatShellHeaderAction({ variant, isActive, className, ...props }: ChatShellHeaderActionProps) {
  return (
    <Button
      data-slot="chat-shell-header-action"
      data-active={isActive || undefined}
      aria-pressed={isActive}
      className={composeRenderProps(className, (c) => cn(chatShellHeaderActionVariants({ variant }), c))}
      {...props}
    />
  );
}

export interface ChatShellBackProps extends Omit<ComponentProps<typeof Button>, 'children'> {
  children?: ReactNode;
}

/** A tinted "‹ #channel" back button, for a view (a full-width thread) that replaces the channel. */
export function ChatShellBack({ className, children, ...props }: ChatShellBackProps) {
  return (
    <Button
      data-slot="chat-shell-back"
      className={composeRenderProps(className, (c) =>
        cn('flex shrink-0 cursor-pointer items-center gap-1 border-0 bg-transparent py-1 pr-1.5 pl-0 font-ios text-[13px] font-[650] text-primary', c),
      )}
      {...props}
    >
      <Icon name="chevron-right-compact" size={13} sw={1.9} className="rotate-180" />
      {children}
    </Button>
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
      className={cn('box-border w-[168px] shrink-0 border-l border-border bg-sidebar [--ck-avatar-ring:var(--sidebar)]', className)}
      {...props}
    />
  );
}

export interface ChatShellPanelProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  title?: ReactNode;
  /** from this shell width up the panel docks as a column; below it, it overlays the conversation */
  dockWidth?: number;
  /** panel width; defaults to min(360, shell width − 60) */
  width?: number;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** A trailing panel for a thread (or details): a SideDrawer that docks beside the conversation on wide shells
 *  and slides over it on narrow ones. */
export function ChatShellPanel({ open, onOpenChange, title = 'Thread', dockWidth = 1180, width, children, className, style }: ChatShellPanelProps) {
  const { width: w } = useChatShell();
  return (
    <SideDrawer
      mode={w >= dockWidth ? 'fixed' : 'overlay'}
      open={open}
      onClose={() => onOpenChange?.(false)}
      title={title}
      width={width ?? Math.min(360, w - 60)}
      // Inside the chat scope the drawer already paints with the chat palette; its close button takes the stronger fill.
      className={cn(
        '[--secondary:var(--secondary-strong,var(--accent))]',
        className,
      )}
      style={style}
    >
      <div data-slot="chat-shell-panel" className="box-border h-full">
        {children}
      </div>
    </SideDrawer>
  );
}
