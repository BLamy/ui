'use client';
import { memo, useMemo, type CSSProperties, type ReactNode } from 'react';
import { createParts, usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { EdgeDrawer, useKeptChildren, type EdgeDrawerProps } from '@/components/ui/edge-drawer';
import {
  adaptivePane,
  type AdaptivePaneApi,
  type AdaptivePaneOptions,
  type AdaptivePanePresentation,
  type AdaptivePaneSide,
} from '@/lib/adaptive-pane-primitive';
import { cn } from '@/lib/utils';

export { createAdaptivePaneController } from '@/lib/adaptive-pane-primitive';
export type {
  AdaptivePaneController,
  AdaptivePaneOpenChangeDetails,
  AdaptivePaneOpenChangeReason,
  AdaptivePanePresentation,
  AdaptivePaneSide,
  AdaptivePaneWidths,
  AdaptivePaneWidthsChangeDetails,
  AdaptivePaneWidthsChangeReason,
} from '@/lib/adaptive-pane-primitive';

/* ══ AdaptivePane — one region, four presentations ══
   presentation="column" docks it beside its siblings in a flex row or grid, "drawer" moves the same children into
   a drawer over the positioned host (UI SDK's Drawer: Escape, a scrim press and a swipe toward its edge close it),
   "cover" fills the host, "hidden" takes it off screen. The host decides the presentation from its own width; the
   children are rendered once and only move, so their state, focus and subscriptions survive every change.

   A column or a drawer can be `resizable`: a separator on the edge it shares with the page drags its width, with
   the keyboard (arrows, Shift+arrows, Home, End, Enter) and by double-click back to the host's width. */

const { Resizer, Edge } = createParts(adaptivePane, { resizer: 'div', edge: 'div' });

export interface AdaptivePaneProps
  extends AdaptivePaneOptions,
    Pick<EdgeDrawerProps, 'zIndex' | 'backdropClassName' | 'scrim' | 'shadow' | 'aria-label' | 'dismissible' | 'modal' | 'swipe'> {
  columnWidth?: number | string;
  drawerWidth?: number | string;
  /** Widest the drawer gets as CSS (`84%`); a number also caps a resize. */
  maxWidth?: number;
  /** CSS max-width for the drawer, like `84%`. */
  drawerMaxWidth?: number | string;
  /** Classes and style of the docked column (and the cover); `className` and `style` apply to the drawer panel. */
  columnClassName?: string;
  columnStyle?: CSSProperties;
  /** A divider on the pane's inner edge that resizes the column or the drawer. */
  resizable?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

const len = (v: number | string | undefined) => (typeof v === 'number' ? v + 'px' : v);

export function AdaptivePane({
  presentation, open, defaultOpen, onOpenChange, widths, defaultWidths, onWidthsChange, side = 'start', minWidth, maxWidth,
  swipeToOpen, controller, columnWidth, drawerWidth, drawerMaxWidth, columnClassName, columnStyle, resizable = false,
  zIndex, backdropClassName, scrim, shadow, 'aria-label': label, dismissible, modal, swipe, className, style, children,
}: AdaptivePaneProps) {
  const handle = usePrimitive(adaptivePane, {
    presentation, open, defaultOpen, onOpenChange, widths, defaultWidths, onWidthsChange, side, minWidth, maxWidth, swipeToOpen, controller,
  } as AdaptivePaneOptions);
  const { api } = handle;
  const kept = useKeptChildren(children);
  // The dock and the separator only change when the pane's own props do, so the presentation below can skip
  // re-rendering while a resize drags (the width is a variable the root writes).
  const dock = useMemo(() => <div ref={kept.dock} className="contents">{kept.inline}</div>, [kept.dock, kept.inline]);
  const resizer = useMemo(() => (resizable ? <PaneResizer side={side} /> : null), [resizable, side]);
  const body = (state: RootState) => (
    <PaneBody presentation={state.presentation} side={state.side} open={state.open} dragging={state.dragging} api={api} dock={dock} resizer={resizer} columnWidth={columnWidth} drawerWidth={drawerWidth}
      drawerMaxWidth={drawerMaxWidth ?? maxWidth} columnClassName={columnClassName} columnStyle={columnStyle} zIndex={zIndex}
      backdropClassName={backdropClassName} scrim={scrim} shadow={shadow} label={label} dismissible={dismissible} modal={modal}
      swipe={swipe} className={className} style={style} />
  );
  return (
    <>
      {kept.portal}
      {usePart(handle, 'root', {}, {
        className: (state: RootState) => {
          if (state.presentation === 'drawer') return 'contents';
          if (state.presentation === 'cover') return cn('absolute inset-0 z-(--adaptive-pane-z)', columnClassName);
          if (state.presentation === 'column') {
            return cn('min-h-0 shrink-0 w-(--adaptive-pane-w)', resizable && 'relative', columnClassName);
          }
          return undefined;
        },
        // The host's widths; a resized width (the root's own `--adaptive-pane-w`) wins over them.
        style: (state: RootState) => (
          state.presentation === 'drawer'
            ? { '--adaptive-pane-w': len(drawerWidth) }
            : state.presentation === 'cover'
              ? { '--adaptive-pane-z': zIndex, ...columnStyle }
              : state.presentation === 'column'
                ? { '--adaptive-pane-w': len(columnWidth), ...columnStyle }
                : undefined
        ) as CSSProperties | undefined,
        children: body,
      }, 'div')}
    </>
  );
}

type RootState = { presentation: AdaptivePanePresentation; side: AdaptivePaneSide; open: boolean; dragging: boolean };

type PaneBodyProps = RootState & Pick<AdaptivePaneProps, 'columnWidth' | 'drawerWidth' | 'drawerMaxWidth' | 'columnClassName' | 'columnStyle'
  | 'zIndex' | 'backdropClassName' | 'scrim' | 'shadow' | 'dismissible' | 'modal' | 'swipe' | 'className' | 'style'> & {
  api: AdaptivePaneApi;
  dock: ReactNode;
  resizer: ReactNode;
  label?: string;
};

/** What the root holds in each presentation. Memoized: a resize drag changes only the root's width variable. */
const PaneBody = memo(function PaneBody({
  presentation, side, open, dragging, api, dock, resizer, drawerMaxWidth, zIndex, backdropClassName, scrim, shadow, label, dismissible, modal, swipe,
  className, style,
}: PaneBodyProps) {
  if (presentation === 'drawer') {
    return (
      <>
        <EdgeDrawer side={side} open={open} aria-label={label ?? 'Pane'} zIndex={zIndex} dismissible={dismissible} modal={modal}
          swipe={swipe}
          onOpenChange={(next, details) => { if (!api.setOpen(next, details)) details.cancel(); }}
          width="var(--adaptive-pane-w)" maxWidth={drawerMaxWidth}
          backdropClassName={backdropClassName} scrim={scrim} shadow={shadow}
          className={cn('touch-pan-y', dragging && 'transition-none', className)} style={style}>
          {dock}
          {resizer}
        </EdgeDrawer>
        <Edge className={cn('absolute inset-y-0 z-(--adaptive-pane-z) w-4 touch-pan-y', edgeClass[side])}
          style={{ '--adaptive-pane-z': zIndex ?? 30 } as CSSProperties} />
      </>
    );
  }
  if (presentation === 'cover') return dock;
  if (presentation === 'column') return <>{dock}{resizer}</>;
  return null;
});

/** The swipe strip, on the pane's own edge of the host. */
const edgeClass: Record<AdaptivePaneSide, string> = { start: 'start-0', end: 'end-0', left: 'left-0', right: 'right-0' };
/** The divider, over the pane's inner edge. */
const resizerClass: Record<AdaptivePaneSide, string> = { start: '-end-[5px]', end: '-start-[5px]', left: '-right-[5px]', right: '-left-[5px]' };

/** The divider on a pane's inner edge: a separator that measures the pane when a drag or key starts, so the host
 *  can give any CSS width and the first resize still begins from what is on screen. */
function PaneResizer({ side }: { side: AdaptivePaneSide }) {
  return (
    <Resizer aria-label="Resize pane"
      className={cn(
        'group/resizer absolute inset-y-0 z-40 w-[10px] cursor-col-resize touch-none outline-none',
        resizerClass[side],
      )}>
      <div className={cn(
        'absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 scale-y-[.96] rounded-full bg-primary opacity-0 transition-[opacity,scale] duration-200',
        'group-hover/resizer:scale-y-100 group-hover/resizer:opacity-45',
        'group-focus-visible/resizer:scale-y-100 group-focus-visible/resizer:opacity-100',
        'group-data-dragging/resizer:scale-y-100 group-data-dragging/resizer:opacity-100',
      )} />
    </Resizer>
  );
}
