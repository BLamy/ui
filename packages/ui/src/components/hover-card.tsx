'use client';
import {
  Children, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
  type FocusEvent, type PointerEvent, type ReactNode, type RefObject, type SyntheticEvent,
} from 'react';
import { OverlayArrow, Popover as AriaPopover, type PopoverProps as AriaPopoverProps, composeRenderProps } from 'react-aria-components';
import { overlayZ, popoverMotion, popoverSurface } from '@/lib/primitives';
import { cn } from '@/lib/utils';
import { useThemeScopeProps } from '@/lib/theme';

/* ══ HoverCard — a preview of what a trigger points at (a person, a link, a file, a commit), shown while the pointer
   rests on it or keyboard focus lands on it. Unlike a Tooltip it is a card: rich content, and the pointer can move
   into it (to select text or follow a link) without it closing. Touch never opens it, so it only ever previews what
   pressing the trigger shows in full. One is open at a time; after one closes, the next opens without the delay
   while you sweep across a list. Portals into BLProvider's root.
   <HoverCardTrigger>
     <a href="/u/june">@june</a>
     <HoverCard>…</HoverCard>
   </HoverCardTrigger>
   Triggers that can't be wrapped (a canvas item, a table cell) use useHoverCard's triggerProps and cardProps. ══ */

/** After a card closes, the next one opens at once for this long. */
const WARM_MS = 700;
let warmUntil = 0;
let openCard: (() => void) | null = null;

export interface UseHoverCardOptions {
  /** ms of hovering before it opens (default 600). Keyboard focus opens it at once. */
  delay?: number;
  /** ms before it closes once the pointer has left both the trigger and the card (default 250). */
  closeDelay?: number;
  isDisabled?: boolean;
  isOpen?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}

export interface HoverCardTriggerProps<T extends HTMLElement = HTMLElement> {
  ref: RefObject<T | null>;
  onPointerEnter: (e: PointerEvent) => void;
  onPointerLeave: (e: PointerEvent) => void;
  onPointerDown: (e: PointerEvent) => void;
  onFocus: (e: FocusEvent) => void;
  onBlur: (e: FocusEvent) => void;
}

export interface HoverCardState<T extends HTMLElement = HTMLElement> {
  isOpen: boolean;
  /** Open or close at once. */
  open: () => void;
  close: () => void;
  /** Open after the delay (none while warm), or close after the close delay: for triggers you hit-test yourself (a
   *  canvas item, a map pin) rather than spreading triggerProps. */
  openSoon: () => void;
  closeSoon: () => void;
  /** Spread on the trigger element. */
  triggerProps: HoverCardTriggerProps<T>;
  /** Spread on the HoverCard. */
  cardProps: Pick<HoverCardProps, 'triggerRef' | 'isOpen' | 'onOpenChange' | 'onPointerEnter' | 'onPointerLeave'>;
}

/** The hover intent behind HoverCardTrigger, for triggers you render yourself. */
export function useHoverCard<T extends HTMLElement = HTMLElement>({
  delay = 600, closeDelay = 250, isDisabled, isOpen: controlled, defaultOpen = false, onOpenChange,
}: UseHoverCardOptions = {}): HoverCardState<T> {
  const [inner, setInner] = useState(defaultOpen);
  const isOpen = !isDisabled && (controlled ?? inner);
  const triggerRef = useRef<T>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latest = useRef({ isOpen, onOpenChange, delay, closeDelay, isDisabled });
  latest.current = { isOpen, onOpenChange, delay, closeDelay, isDisabled };

  const set = useCallback((next: boolean) => {
    clearTimeout(timer.current);
    if (next === latest.current.isOpen) return;
    latest.current.isOpen = next;
    setInner(next);
    latest.current.onOpenChange?.(next);
    if (next) {
      if (openCard && openCard !== closeSelf.current) openCard();
      openCard = closeSelf.current;
    } else if (openCard === closeSelf.current) {
      openCard = null;
      warmUntil = Date.now() + WARM_MS;
    }
  }, []);
  const closeSelf = useRef(() => set(false));

  const openSoon = useCallback(() => {
    clearTimeout(timer.current);
    if (latest.current.isDisabled) return;
    if (Date.now() < warmUntil) set(true);
    else timer.current = setTimeout(() => set(true), latest.current.delay);
  }, [set]);
  const closeSoon = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => set(false), latest.current.closeDelay);
  }, [set]);
  const open = useCallback(() => set(true), [set]);
  const close = useCallback(() => set(false), [set]);
  const hold = useCallback(() => clearTimeout(timer.current), []);

  // Esc closes it.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') set(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, set]);
  useEffect(() => () => {
    clearTimeout(timer.current);
    if (openCard === closeSelf.current) openCard = null;
  }, []);

  const triggerProps = useMemo<HoverCardTriggerProps<T>>(() => ({
    ref: triggerRef,
    onPointerEnter: (e) => { if (e.pointerType !== 'touch') openSoon(); },
    onPointerLeave: (e) => { if (e.pointerType !== 'touch') closeSoon(); },
    // A press means the pointer wasn't only resting: no card over whatever the press opens.
    onPointerDown: () => set(false),
    // Keyboard focus only: a click focuses too, and shouldn't pop a card over what it opens.
    onFocus: (e) => { if ((e.target as Element).matches?.(':focus-visible') && !latest.current.isDisabled) set(true); },
    onBlur: () => closeSoon(),
  }), [openSoon, closeSoon, set]);

  return {
    isOpen,
    open,
    close,
    openSoon,
    closeSoon,
    triggerProps,
    cardProps: { triggerRef, isOpen, onOpenChange: set, onPointerEnter: hold, onPointerLeave: closeSoon },
  };
}

const stop = (e: SyntheticEvent) => e.stopPropagation();

const HoverCardContext = createContext<HoverCardState | null>(null);

export interface HoverCardTriggerComponentProps extends UseHoverCardOptions {
  /** The trigger, then the HoverCard. */
  children: ReactNode;
  /** Classes for the inline wrapper that anchors the card (`inline-flex max-w-full`); `flex w-full` for a row. */
  className?: string;
}

/** Opens the HoverCard after it while the pointer rests on its first child, or keyboard focus lands in it. */
export function HoverCardTrigger({ children, className, ...options }: HoverCardTriggerComponentProps) {
  const state = useHoverCard<HTMLSpanElement>(options);
  const [trigger, ...card] = Children.toArray(children);
  return (
    <HoverCardContext.Provider value={state as unknown as HoverCardState}>
      <span data-slot="hover-card-trigger" data-open={state.isOpen || undefined} {...state.triggerProps} className={cn('inline-flex max-w-full min-w-0', className)}>
        {trigger}
      </span>
      {card}
    </HoverCardContext.Provider>
  );
}

export interface HoverCardProps extends Omit<AriaPopoverProps, 'children' | 'isNonModal' | 'trigger'> {
  children?: ReactNode;
  /** Draw a pointer toward the trigger (default false). */
  arrow?: boolean;
  /** Keep it open while the pointer is over it (wired by HoverCardTrigger / useHoverCard's cardProps). */
  onPointerEnter?: () => void;
  onPointerLeave?: () => void;
  /** Classes for the padded content inside the surface (`p-4`). */
  contentClassName?: string;
}

/** The card: a non-modal popover surface (18rem wide by default) that never takes focus or blocks the page. */
export function HoverCard({
  children, className, style, contentClassName, offset = 8, placement = 'bottom', arrow = false,
  onPointerEnter, onPointerLeave, triggerRef, isOpen, onOpenChange, ...props
}: HoverCardProps) {
  const ctx = useContext(HoverCardContext)?.cardProps;
  const scope = useThemeScopeProps();
  const ref = triggerRef ?? ctx?.triggerRef;
  if (!ref) return null;
  const enter = onPointerEnter ?? ctx?.onPointerEnter;
  const leave = onPointerLeave ?? ctx?.onPointerLeave;
  return (
    <AriaPopover
      data-slot="hover-card"
      data-theme-scope={scope['data-theme-scope']}
      triggerRef={ref}
      isOpen={isOpen ?? ctx?.isOpen ?? false}
      onOpenChange={onOpenChange ?? ctx?.onOpenChange}
      isNonModal
      offset={offset}
      placement={placement}
      className={composeRenderProps(className, (cls) => cn(popoverSurface, popoverMotion, overlayZ, 'w-72 max-w-[calc(100vw-24px)]', scope.className, cls))}
      style={composeRenderProps(style, (s) => ({ ...scope.style, ...s }))}
      {...props}
    >
      {arrow ? (
        <OverlayArrow data-slot="hover-card-arrow" className="group">
          <svg width={12} height={6} viewBox="0 0 12 6" aria-hidden="true"
            className="block fill-popover group-data-[placement=bottom]:rotate-180 group-data-[placement=left]:-rotate-90 group-data-[placement=right]:rotate-90">
            <path d="M0 0 L6 6 L12 0" />
          </svg>
        </OverlayArrow>
      ) : null}
      {/* The card portals out, but React still bubbles its events through the trigger's ancestors: a press in the card
          must not also press the row or button it previews. */}
      <div data-slot="hover-card-content" className={cn('p-4 text-subhead', contentClassName)}
        onPointerEnter={(e) => { if (e.pointerType !== 'touch') enter?.(); }}
        onPointerLeave={(e) => { if (e.pointerType !== 'touch') leave?.(); }}
        onPointerDown={stop} onPointerUp={stop} onMouseDown={stop} onMouseUp={stop} onClick={stop} onDoubleClick={stop} onContextMenu={stop}>
        {children}
      </div>
    </AriaPopover>
  );
}

export interface HoverCardHeaderProps {
  /** An Avatar, icon or thumbnail. */
  media?: ReactNode;
  title: ReactNode;
  /** A handle, path or kind under the title. */
  subtitle?: ReactNode;
  /** Trailing control (a Follow button, a status Badge). */
  action?: ReactNode;
  className?: string;
}

/** The usual top of a card: media, a title and subtitle, and an optional action. */
export function HoverCardHeader({ media, title, subtitle, action, className }: HoverCardHeaderProps) {
  return (
    <div data-slot="hover-card-header" className={cn('flex min-w-0 items-center gap-3', className)}>
      {media ? <div className="shrink-0">{media}</div> : null}
      <div className="min-w-0 flex-1">
        <div className="truncate text-headline font-semibold text-foreground">{title}</div>
        {subtitle ? <div className="truncate text-footnote text-muted-foreground">{subtitle}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
