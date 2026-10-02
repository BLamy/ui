'use client';
import {
  createContext, use, useEffect, useRef, useState,
  type ComponentProps, type KeyboardEvent, type MouseEvent, type PointerEvent,
} from 'react';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSection, DropdownMenuSeparator,
  DropdownMenuShortcut, DropdownMenuSub, type DropdownMenuContentProps,
} from '@/components/ui/dropdown-menu';
import { PlainButton } from '@/components/ui/plain-button';
import { cn } from '@/lib/utils';

/* ══ ContextMenu — the DropdownMenu, opened where you right-click (or long-press, or press the menu key) instead of
   from a button. The area is a wrapper `div`; its menu is a `ContextMenuContent` inside it:
   <ContextMenu className="…">
     …anything, buttons included…
     <ContextMenuContent aria-label="Dock">
       <ContextMenuItem onAction={…}>Turn Hiding On</ContextMenuItem>
     </ContextMenuContent>
   </ContextMenu> ══ */

interface Point { x: number; y: number }

interface MenuState {
  /** Where the menu is anchored, relative to the area; null while it is closed. */
  point: Point | null;
  close: () => void;
}
const Ctx = createContext<MenuState | null>(null);

export interface ContextMenuProps extends ComponentProps<'div'> {
  /** Turns the menu off: the browser's own context menu shows instead. */
  isDisabled?: boolean;
  /** Called when the menu opens or closes. */
  onOpenChange?: (open: boolean) => void;
  /** How long a touch or pen press has to hold before it opens the menu (ms). Default 500. */
  longPressDelay?: number;
  /** Where the menu hangs: `pointer` (default) at the pointer; `top` or `bottom` at the pointer's x on the area's top
   *  or bottom edge, for a menu that should clear the area (a dock's menu above it) — pair with `placement` on the
   *  content. */
  anchor?: 'pointer' | 'top' | 'bottom';
}

/** A touch that travels this far is a scroll or a swipe, not a long press. */
const LONG_PRESS_SLOP = 8;

export function ContextMenu({
  className, children, isDisabled, onOpenChange, longPressDelay = 500, anchor = 'pointer',
  onContextMenu, onKeyDown, onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture, ...props
}: ContextMenuProps) {
  const area = useRef<HTMLDivElement>(null);
  const [point, setPoint] = useState<Point | null>(null);
  const open = useRef(false);
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> } | null>(null);
  const swallowClick = useRef(false);

  const openAt = (clientX: number, clientY: number) => {
    // One gesture can announce itself twice (the key's keydown and the browser's contextmenu): the first one wins.
    if (open.current || !area.current) return;
    const r = area.current.getBoundingClientRect();
    open.current = true;
    setPoint({ x: clientX - r.left, y: anchor === 'top' ? 0 : anchor === 'bottom' ? r.height : clientY - r.top });
    onOpenChange?.(true);
  };
  const close = () => {
    open.current = false;
    setPoint(null);
    onOpenChange?.(false);
  };
  // While the menu is open react-aria makes everything else inert, so a right-click elsewhere lands on the document,
  // not on whatever is under the pointer. A system menu closes and acts on that click anyway (right-click another
  // item and its menu opens): do the same, finding the area under the pointer by geometry, since inert elements
  // are skipped by hit-testing.
  const forwarding = useRef(false);
  useEffect(() => {
    if (!point) return undefined;
    const onOutside = (e: globalThis.MouseEvent) => {
      if (forwarding.current) return;
      e.preventDefault();
      if ((e.target as Element).closest?.('[data-slot=dropdown-menu]')) return;
      e.stopPropagation();
      close();
      const areas = [...document.querySelectorAll<HTMLElement>('[data-slot=context-menu]')].filter((el) => {
        const r = el.getBoundingClientRect();
        return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      });
      // The innermost area wins: the smallest box under the pointer.
      areas.sort((a, b) => a.offsetWidth * a.offsetHeight - b.offsetWidth * b.offsetHeight);
      forwarding.current = true;
      try {
        areas[0]?.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, composed: true, button: 2, clientX: e.clientX, clientY: e.clientY }));
      } finally { forwarding.current = false; }
    };
    document.addEventListener('contextmenu', onOutside, true);
    return () => document.removeEventListener('contextmenu', onOutside, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [point]);
  const cancelPress = () => {
    if (press.current) clearTimeout(press.current.timer);
    press.current = null;
  };

  return (
    <Ctx.Provider value={{ point, close }}>
      <div
        ref={area}
        data-slot="context-menu"
        data-open={point ? '' : undefined}
        {...props}
        // `relative`: the menu's anchor is positioned inside the area. The callout rule stops iOS from selecting text
        // and showing its own sheet on the long press that opens this menu.
        className={cn('relative', !isDisabled && '[-webkit-touch-callout:none]', className)}
        onContextMenu={(e: MouseEvent<HTMLDivElement>) => {
          onContextMenu?.(e);
          if (isDisabled || e.defaultPrevented) return;
          e.preventDefault();
          // A right-click on the open menu itself (it bubbles up through the portal) does nothing.
          if (!e.currentTarget.contains(e.target as Node)) return;
          openAt(e.clientX, e.clientY);
        }}
        onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
          onKeyDown?.(e);
          if (isDisabled || e.defaultPrevented) return;
          if (e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10')) {
            e.preventDefault();
            // From the keyboard there is no pointer: open at the bottom-left of what has focus.
            const r = (e.target as HTMLElement).getBoundingClientRect();
            openAt(r.left, r.bottom);
          }
        }}
        // iOS Safari never fires `contextmenu` for a long press, so touch and pen open on a held press.
        onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
          onPointerDown?.(e);
          if (isDisabled || e.pointerType === 'mouse' || !e.isPrimary) return;
          cancelPress();
          const { clientX: x, clientY: y, pointerId } = e;
          const target = e.currentTarget;
          press.current = {
            x, y,
            timer: setTimeout(() => {
              press.current = null;
              openAt(x, y);
              swallowClick.current = true;
              // The finger is still down on whatever it pressed. Moving the pointer to the area cancels that press
              // (the control sees the pointer leave), so lifting the finger doesn't also activate it.
              try { target.setPointerCapture(pointerId); } catch { /* the pointer is already gone */ }
            }, longPressDelay),
          };
        }}
        onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
          onPointerMove?.(e);
          const p = press.current;
          if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > LONG_PRESS_SLOP) cancelPress();
        }}
        onPointerUp={(e: PointerEvent<HTMLDivElement>) => { onPointerUp?.(e); cancelPress(); }}
        onPointerCancel={(e: PointerEvent<HTMLDivElement>) => { onPointerCancel?.(e); cancelPress(); }}
        onClickCapture={(e: MouseEvent<HTMLDivElement>) => {
          onClickCapture?.(e);
          if (!swallowClick.current) return;
          swallowClick.current = false;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {children}
      </div>
    </Ctx.Provider>
  );
}

/** The menu: place it inside a `ContextMenu`. Takes everything `DropdownMenuContent` does; it opens at the pointer
 *  (below and to its right, flipping to stay on screen) — `placement` changes that. */
export function ContextMenuContent<T extends object>({ placement = 'bottom start', ...props }: DropdownMenuContentProps<T>) {
  const ctx = use(Ctx);
  if (!ctx) throw new Error('ContextMenuContent must be used inside <ContextMenu>');
  const { point, close } = ctx;
  return (
    // The menu hangs off an invisible anchor at the pointer. Nothing else is inside the trigger: react-aria would turn
    // every pressable in it into the menu's button.
    <DropdownMenu isOpen={point !== null} onOpenChange={(o) => { if (!o) close(); }}>
      <PlainButton
        // Only a place for the menu to hang from: inert takes it out of the accessibility tree and the focus order.
        inert
        excludeFromTabOrder
        className="pointer-events-none absolute size-0 opacity-0"
        style={{ left: point?.x ?? 0, top: point?.y ?? 0 }}
      />
      <DropdownMenuContent placement={placement} {...props} />
    </DropdownMenu>
  );
}

export const ContextMenuItem = DropdownMenuItem;
export const ContextMenuSection = DropdownMenuSection;
export const ContextMenuLabel = DropdownMenuLabel;
export const ContextMenuSeparator = DropdownMenuSeparator;
export const ContextMenuShortcut = DropdownMenuShortcut;
export const ContextMenuSub = DropdownMenuSub;
