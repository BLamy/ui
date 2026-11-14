'use client';
import { useCallback, useLayoutEffect, useState, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Side } from '@ui-sdk/core';
import { DrawerBackdrop as SdkDrawerBackdrop, DrawerContent as SdkDrawerContent, type DrawerProps } from '@ui-sdk/react/drawer';
import { cva } from 'class-variance-authority';
import { Sheet } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

/* ══ EdgeDrawer — UI SDK's Drawer as a panel over a positioned host ══
   The overlay presentation that Sidebar, SideDrawer and AdaptivePane share. It fills its positioned parent with a
   layer host, so the Drawer (focus trap, Escape, outside press, swipe toward its edge to close, the tray spring)
   stays inside that box: a scrim over the host, and a full-height panel from a side edge (`start` and `end` follow the
   reading direction, as in UI SDK). No chrome of
   its own: the children are the whole panel. Style hooks: the panel has `data-edge-drawer`, the scrim
   `data-edge-drawer-scrim` (their `data-slot`s are UI SDK's `drawer-content` and `drawer-backdrop`). An internal building block, not a public component: reach for Sheet
   (modal) or FloatingSheet (beside the page) instead. */

/** The sliding panel: full height on its edge, lifted while it is out. UI SDK moves it (leave `translate` alone).
 *  `side` is the physical edge UI SDK resolved (the content's `data-side`). */
export const edgeDrawerVariants = cva('pointer-events-auto relative box-border h-full outline-none data-dragging:select-none', {
  variants: {
    side: { left: 'mr-auto', right: 'ml-auto' },
    /** The default lifted shadow (off when the caller gives its own). */
    lifted: { true: 'shadow-[0_0_44px_black] shadow-black/50', false: '' },
  },
  defaultVariants: { side: 'left', lifted: true },
});

export interface EdgeDrawerProps extends Pick<DrawerProps, 'onOpenChange' | 'dismissible' | 'modal'> {
  /** The edge the panel comes from. `start` and `end` follow the reading direction. Default `start`. */
  side?: Extract<Side, 'start' | 'end' | 'left' | 'right'>;
  open: boolean;
  /** The panel's accessible name. */
  'aria-label'?: string;
  width?: number | string;
  maxWidth?: number | string;
  /** z-index of the host layer over the page. */
  zIndex?: number;
  /** Classes for the scrim (default `bg-black/45`; e.g. `bg-overlay`, `bg-transparent`). */
  backdropClassName?: string;
  /** Any CSS background for the scrim: a runtime override of `backdropClassName`'s color. */
  scrim?: string;
  /** Any CSS box-shadow for the open panel, replacing the default lift (`none` for flat). Or pass `shadow-*`
   *  utilities in `className`. */
  shadow?: string;
  /** Whether a drag of the panel toward its edge closes it. Default true. `false` keeps Escape and the scrim, and
   *  the panel no longer follows the finger (UI SDK's `data-drawer-no-drag`). */
  swipe?: boolean;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

const len = (v: number | string | undefined) => (typeof v === 'number' ? v + 'px' : v);

export function EdgeDrawer({
  side = 'start', open, onOpenChange, dismissible, modal, 'aria-label': label, width, maxWidth, zIndex = 30,
  backdropClassName, scrim, shadow, swipe = true, children, className, style,
}: EdgeDrawerProps) {
  return (
    // A layer host (UI SDK's `data-layer-host`, with the `contain: layout` it needs), marked in the markup, so a
    // drawer open on the first render is already contained.
    <div
      data-slot="edge-drawer-host"
      data-layer-host=""
      className="pointer-events-none absolute inset-0 z-(--edge-drawer-z) overflow-clip [contain:layout]"
      style={{ '--edge-drawer-z': zIndex } as CSSProperties}
    >
      {/* In place (`container={null}`): the host above is the drawer's box. */}
      <Sheet side={side} open={open} onOpenChange={onOpenChange} dismissible={dismissible} modal={modal} container={null} preventEdgeSwipe>
        {/* A non-modal drawer sits beside a usable page: no scrim to dim it or take its presses. */}
        {modal === false ? null : (
          <SdkDrawerBackdrop
            data-edge-drawer-scrim=""
            className={cn('pointer-events-auto fixed inset-0 bg-black/45', backdropClassName, scrim != null && 'bg-(--edge-drawer-scrim)')}
            style={scrim != null ? ({ '--edge-drawer-scrim': scrim } as CSSProperties) : undefined}
          />
        )}
        <SdkDrawerContent
          keepMounted
          data-edge-drawer=""
          data-drawer-no-drag={swipe ? undefined : ''}
          aria-label={label}
          initialFocus="content"
          className={(state) => cn(
            edgeDrawerVariants({ side: state.side === 'right' ? 'right' : 'left', lifted: shadow == null }),
            width != null && 'w-(--edge-drawer-w)',
            maxWidth != null && 'max-w-(--edge-drawer-max-w)',
            shadow != null && state.open && '[box-shadow:var(--edge-drawer-shadow)]',
            className,
          )}
          // Size and caller colors are props, fed in as variables.
          style={{
            ...(width != null ? { '--edge-drawer-w': len(width) } : null),
            ...(maxWidth != null ? { '--edge-drawer-max-w': len(maxWidth) } : null),
            ...(shadow != null ? { '--edge-drawer-shadow': shadow } : null),
            ...style,
          } as CSSProperties}
        >
          {children}
        </SdkDrawerContent>
      </Sheet>
    </div>
  );
}

/* ── Children that survive a change of presentation ──
   A pane that moves between a column, a drawer and a pushed page renders its children once, through a portal, into
   a detached element, and each presentation docks that element where it shows them: the same React tree and the
   same DOM nodes, so fields, selection and subscriptions carry over. Until hydration the children render in the
   dock itself, so the server's markup matches. */

const subscribeNothing = () => () => undefined;

export function useKeptChildren(children: ReactNode) {
  const hydrated = useSyncExternalStore(subscribeNothing, () => true, () => false);
  const [node] = useState(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.style.display = 'contents';
    return el;
  });
  const kept = hydrated && node != null;
  /** A ref for the element the children show in now. */
  const dock = useCallback((el: HTMLElement | null) => {
    if (el && node && node.parentNode !== el) el.appendChild(node);
  }, [node]);
  useLayoutEffect(() => () => node?.remove(), [node]);
  return {
    dock,
    /** Render once, anywhere under the component: the children's one home in the React tree. */
    portal: kept ? createPortal(children, node) : null,
    /** Render inside the dock: the children before hydration, else nothing. */
    inline: kept ? null : children,
  };
}
