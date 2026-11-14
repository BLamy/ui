'use client';
import {
  createContext, memo, use, useContext, useId, useLayoutEffect, useMemo, useState,
  type ComponentProps, type CSSProperties, type ReactNode,
} from 'react';
import { createParts, usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { Sheet, SheetBackdrop, SheetContent, type SheetProps } from '@/components/ui/sheet';
import { closeButtonVariants, surfaceHeaderVariants, surfaceTitleVariants } from '@/lib/surface';
import {
  adaptivePane,
  type AdaptivePaneApi,
  type AdaptivePaneOptions,
  type AdaptivePanePresentation,
  type AdaptivePaneSide,
} from '@/lib/adaptive-pane-primitive';
import { useSizeClassScope, type SizeClass } from '@/lib/container';
import { Icon } from '@/lib/icon';
import { useKeptChildren } from '@/lib/kept-children';
import { focusRing } from '@/lib/primitives';
import { BLSafeCtx } from '@/lib/theme';
import { BARH, cn, cx } from '@/lib/utils';

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

/* ══ AdaptivePane — one region, five presentations ══
   The same children as a docked `column`, a `drawer` over the host from its side (a contained Sheet: Escape, a
   scrim press and a swipe toward its edge close it), a `push` (a page pushed over the host from the trailing edge,
   NavigationStack-style: back, Escape, the platform back and an edge swipe pop it), a `cover` that fills the host,
   or `hidden`. `presentation="auto"` (the default) picks one from the size-class scope: a column in a regular
   scope, a drawer in a medium one, and in a compact one a push for an `end` pane, a drawer otherwise. `open` says
   whether it shows, in every presentation. The children are rendered once and only move, so their state, focus
   and subscriptions survive every change.
     <AdaptivePane side="end" open={open} onOpenChange={setOpen} aria-label="Activity">
       <AdaptivePaneHeader>
         <AdaptivePaneTitle>Activity</AdaptivePaneTitle>
         <AdaptivePaneClose backLabel="Inbox" />     × in a column or drawer, "‹ Inbox" in a push
       </AdaptivePaneHeader>
       …
     </AdaptivePane>
   A column or a drawer can be `resizable`: a separator on the edge it shares with the page drags its width, with
   the keyboard (arrows, Shift+arrows, Home, End, Enter) and by double-click back to the host's width. ══ */

const { Resizer, Edge, Dim, Page, Close } = createParts(adaptivePane, {
  resizer: 'div',
  edge: 'div',
  dim: 'div',
  page: 'section',
  close: 'button',
});

/** What `className` and `style` are given when they are functions. */
export type AdaptivePaneState = { presentation: AdaptivePanePresentation; open: boolean; side: AdaptivePaneSide };

export interface AdaptivePaneProps extends Omit<AdaptivePaneOptions, 'presentation'> {
  /** How it shows. Default `auto`: from the size-class scope (regular: `column`, medium: `drawer`, compact: `push`
   *  for an `end` pane, else `drawer`). */
  presentation?: AdaptivePanePresentation | 'auto';
  /** The column's width (any CSS length; a number is px). The host's grid or flex track can size it instead. */
  columnWidth?: number | string;
  /** The drawer's width. Default 20rem, at most 85% of the host. */
  drawerWidth?: number | string;
  /** A divider on the pane's inner edge that resizes the column or the drawer. */
  resizable?: boolean;
  /** Whether a drag of the drawer toward its edge closes it. Default true. */
  swipe?: boolean;
  /** The drawer's modality (UI SDK's Drawer `modal`): `false` puts it beside a usable page, without a scrim. */
  modal?: SheetProps['modal'];
  /** `false`: Escape, the scrim and the swipe can't close the drawer. */
  dismissible?: SheetProps['dismissible'];
  /** The stacking order of the drawer, push or cover over the host's other children. Default 30. */
  zIndex?: number;
  /** The pane's name. Default: its AdaptivePaneTitle. */
  'aria-label'?: string;
  /** Classes of the pane's box in every presentation: the column, the drawer's panel, the pushed page, the cover.
   *  A function gets `{ presentation, open, side }`. */
  className?: string | ((state: AdaptivePaneState) => string | undefined);
  style?: CSSProperties | ((state: AdaptivePaneState) => CSSProperties | undefined);
  children?: ReactNode;
}

/** `auto`, resolved against the size class of the scope the pane is written in. Outside every scope: regular. */
function resolvePresentation(presentation: AdaptivePanePresentation | 'auto', side: AdaptivePaneSide, sizeClass: SizeClass | undefined): AdaptivePanePresentation {
  if (presentation !== 'auto') return presentation;
  if (sizeClass === 'compact') return side === 'end' ? 'push' : 'drawer';
  return sizeClass === 'medium' ? 'drawer' : 'column';
}

/* What the parts inside read: the presentation that shows and the pane's naming. */
type PaneContext = { presentation: AdaptivePanePresentation; titleId: string; setTitled: (on: boolean) => void };
const AdaptivePaneContext = createContext<PaneContext | null>(null);
function usePane(part: string): PaneContext {
  const pane = useContext(AdaptivePaneContext);
  if (!pane) throw new Error(`<${part}> must be used inside <AdaptivePane>.`);
  return pane;
}

const len = (v: number | string | undefined) => (typeof v === 'number' ? v + 'px' : v);
const resolve = <T,>(value: T | ((state: AdaptivePaneState) => T) | undefined, state: AdaptivePaneState) =>
  typeof value === 'function' ? (value as (state: AdaptivePaneState) => T)(state) : value;

export function AdaptivePane({
  presentation = 'auto', open, defaultOpen, onOpenChange, widths, defaultWidths, onWidthsChange, side = 'start', minWidth, maxWidth,
  swipeToOpen, controller, columnWidth, drawerWidth, resizable = false, swipe, modal, dismissible, zIndex = 30,
  'aria-label': label, className, style, children,
}: AdaptivePaneProps) {
  const shown = resolvePresentation(presentation, side, useSizeClassScope());
  const handle = usePrimitive(adaptivePane, {
    presentation: shown, open, defaultOpen, onOpenChange, widths, defaultWidths, onWidthsChange, side, minWidth, maxWidth, swipeToOpen, controller,
  } as AdaptivePaneOptions);
  const { api } = handle;
  const kept = useKeptChildren(children);
  const titleId = useId();
  const [titled, setTitled] = useState(false);
  const context = useMemo(() => ({ presentation: shown, titleId, setTitled }), [shown, titleId]);
  // The dock and the separator only change when the pane's own props do, so the presentation below can skip
  // re-rendering while a resize drags (the width is a variable the root writes).
  const dock = useMemo(() => <div ref={kept.dock} className="contents">{kept.inline}</div>, [kept.dock, kept.inline]);
  const resizer = useMemo(() => (resizable ? <PaneResizer side={side} /> : null), [resizable, side]);
  const naming = useMemo(() => (label ? { 'aria-label': label } : titled ? { 'aria-labelledby': titleId } : { 'aria-label': 'Pane' }), [label, titled, titleId]);
  return usePart(handle, 'root', {}, {
    className: (state: RootState) => {
      const own = { presentation: state.presentation, open: state.open, side: state.side };
      // Closed, a column or a cover leaves the layout (the `hidden` the root gets, which a display class would beat).
      if (state.presentation === 'column') {
        return cn('flex min-h-0 shrink-0 flex-col w-(--adaptive-pane-w)', resizable && 'relative', resolve(className, own), !state.open && 'hidden');
      }
      if (state.presentation === 'cover') {
        return cn('absolute inset-0 z-(--adaptive-pane-z) flex flex-col bg-background', resolve(className, own), !state.open && 'hidden');
      }
      if (state.presentation === 'drawer' || state.presentation === 'push') {
        return cn('group/adaptive-pane pointer-events-none absolute inset-0 z-(--adaptive-pane-z)');
      }
      return undefined;
    },
    // The host's widths; a resized width (the root's own `--adaptive-pane-w`) wins over them.
    style: (state: RootState) => {
      const own = { presentation: state.presentation, open: state.open, side: state.side };
      const width = state.presentation === 'drawer' ? len(drawerWidth) : state.presentation === 'column' ? len(columnWidth) : undefined;
      return {
        '--adaptive-pane-z': zIndex,
        ...(width === undefined ? null : { '--adaptive-pane-w': width }),
        ...(state.presentation === 'column' || state.presentation === 'cover' ? resolve(style, own) : null),
      } as CSSProperties;
    },
    // The kept children's one place in the tree (inside the root, so the parts in them find the pane).
    children: (state: RootState) => {
      const own = { presentation: state.presentation, open: state.open, side: state.side };
      const overlay = state.presentation === 'drawer' || state.presentation === 'push';
      return (
        <AdaptivePaneContext.Provider value={context}>
          {kept.portal}
          <PaneBody presentation={state.presentation} side={state.side} open={state.open} dragging={state.dragging} api={api} dock={dock}
            resizer={resizer} modal={modal} dismissible={dismissible} swipe={swipe} naming={naming}
            panelClassName={overlay ? resolve(className, own) : undefined} panelStyle={overlay ? resolve(style, own) : undefined} />
        </AdaptivePaneContext.Provider>
      );
    },
  }, 'div');
}

type RootState = { presentation: AdaptivePanePresentation; side: AdaptivePaneSide; open: boolean; dragging: boolean };

type PaneBodyProps = RootState & Pick<AdaptivePaneProps, 'modal' | 'dismissible' | 'swipe'> & {
  api: AdaptivePaneApi;
  dock: ReactNode;
  resizer: ReactNode;
  naming: { 'aria-label'?: string; 'aria-labelledby'?: string };
  panelClassName?: string;
  panelStyle?: CSSProperties;
};

/** What the root holds in each presentation. Memoized: a resize drag changes only the root's width variable. */
const PaneBody = memo(function PaneBody({
  presentation, side, open, dragging, api, dock, resizer, modal, dismissible, swipe, naming, panelClassName, panelStyle,
}: PaneBodyProps) {
  if (presentation === 'drawer') {
    return (
      <>
        <Sheet contained side={side} open={open} dismissible={dismissible} modal={modal}
          onOpenChange={(next, details) => { if (!api.setOpen(next, details)) details.cancel(); }}>
          {/* A non-modal drawer sits beside a usable page: no scrim to dim it or take its presses. */}
          {modal === false ? null : <SheetBackdrop />}
          <SheetContent variant="panel" keepMounted initialFocus="content" swipe={swipe} {...naming}
            className={cn('w-[var(--adaptive-pane-w,20rem)] touch-pan-y', dragging && 'transition-none', panelClassName)} style={panelStyle}>
            {dock}
            {resizer}
          </SheetContent>
        </Sheet>
        <Edge className={cn('pointer-events-auto absolute inset-y-0 w-4 touch-pan-y', edgeClass[side])} />
      </>
    );
  }
  if (presentation === 'push') return <PanePush open={open} naming={naming} className={panelClassName} style={panelStyle}>{dock}</PanePush>;
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

/* ── The push ──
   The pane is a NavigationStack screen pushed over the host's page: it waits just past the trailing edge, enters on
   the smooth spring, and the page under it (opted in with `adaptivePanePageClass`) parallaxes under a dim and is
   inert. An edge swipe scrubs all three with the finger (`data-swiping`, `--stack-progress`,
   `--adaptive-pane-progress`, `--adaptive-pane-under`) and, released, all three settle on the tray spring
   (`data-swipe-settling`). */

function PanePush({ open, naming, className, style, children }: {
  open: boolean; naming: PaneBodyProps['naming']; className?: string; style?: CSSProperties; children: ReactNode;
}) {
  return (
    <>
      <Dim
        className={cn(
          'absolute inset-0 bg-black transition-opacity duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
          open ? 'pointer-events-auto opacity-12' : 'pointer-events-none opacity-0',
          'group-data-swiping/adaptive-pane:opacity-[calc(.12*(1-var(--adaptive-pane-progress,0)))] group-data-swiping/adaptive-pane:transition-none',
          'group-data-swipe-settling/adaptive-pane:duration-spring-tray group-data-swipe-settling/adaptive-pane:ease-spring-tray',
        )} />
      <Page {...naming}
        className={cn(
          'pointer-events-auto absolute inset-0 flex touch-pan-y flex-col overflow-hidden bg-background shadow-[-10px_0_30px_black] shadow-black/16 outline-none will-change-transform',
          // Offsets are times `--stack-dir` (-1 right to left): it enters from the trailing edge, swipes from the leading one.
          'rtl:[--stack-dir:-1] rtl:shadow-[10px_0_30px_black]',
          'transition-[translate] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none',
          'data-starting-style:translate-x-[calc(103%*var(--stack-dir,1))] data-ending-style:translate-x-[calc(103%*var(--stack-dir,1))] data-ending-style:pointer-events-none',
          'data-swiping:translate-x-[calc(var(--stack-progress)*100%*var(--stack-dir,1))] data-swiping:transition-none',
          'data-swipe-settling:duration-spring-tray data-swipe-settling:ease-spring-tray',
          className,
        )}
        style={style}>
        {children}
      </Page>
    </>
  );
}

/** Put on the page under a pushed AdaptivePane (an element before it in the same host) so it parallaxes away and
 *  follows a swipe as a NavigationStack screen's page does. It reads the host's `--adaptive-pane-under`. */
export const adaptivePanePageClass = cn(
  'translate-x-[calc(var(--adaptive-pane-under,0)*-28%*var(--stack-dir,1))] transition-[translate] duration-spring-smooth ease-spring-smooth motion-reduce:transition-none rtl:[--stack-dir:-1]',
  '[[data-adaptive-pane-swiping]>&]:transition-none',
  '[[data-adaptive-pane-settling]>&]:duration-spring-tray [[data-adaptive-pane-settling]>&]:ease-spring-tray',
);

/* ── Header parts ──
   One header for every presentation: in a column, a drawer or a cover, the title and a round × in a row; in a
   push, the NavigationStack bar (the back button on the leading edge, the title centred, under the safe area). */

/** The pane's title row. Put an AdaptivePaneTitle and an AdaptivePaneClose in it (and any actions after them). */
export function AdaptivePaneHeader({ className, style, ...props }: ComponentProps<'div'>) {
  const { presentation } = usePane('AdaptivePaneHeader');
  const safeTop = use(BLSafeCtx);
  if (presentation === 'push') {
    return (
      <div data-slot="adaptive-pane-header" data-presentation="push"
        className={cn(
          'relative box-border grid h-(--adaptive-pane-bar-h) shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)] items-center px-1.5 pt-(--adaptive-pane-safe-top)',
          'border-b border-border bg-background/86 backdrop-blur-[18px] backdrop-saturate-[1.7]',
          className,
        )}
        // The bar's height follows the frame's safe area, measured at runtime.
        style={{ '--adaptive-pane-bar-h': safeTop + BARH + 'px', '--adaptive-pane-safe-top': safeTop + 'px', ...style } as CSSProperties}
        {...props} />
    );
  }
  return <div data-slot="adaptive-pane-header" className={cn(surfaceHeaderVariants({ variant: 'bar' }), className)} style={style} {...props} />;
}

/** The pane's title, which names it (unless the pane has an `aria-label`). A level 2 heading. */
export function AdaptivePaneTitle({ className, id, ...props }: ComponentProps<'h2'>) {
  const { presentation, titleId, setTitled } = usePane('AdaptivePaneTitle');
  useLayoutEffect(() => {
    setTitled(true);
    return () => setTitled(false);
  }, [setTitled]);
  return (
    <h2 data-slot="adaptive-pane-title" id={id ?? titleId}
      className={cn(
        presentation === 'push'
          ? 'col-start-2 row-start-1 m-0 truncate text-center text-body font-semibold text-foreground'
          : cn(surfaceTitleVariants({ size: 'sm' }), 'min-w-0 flex-1 truncate py-1'),
        className,
      )}
      {...props} />
  );
}

export type AdaptivePaneCloseProps = ComponentProps<typeof Close> & {
  /** What a pushed pane goes back to, shown beside the chevron. Default "Back". */
  backLabel?: ReactNode;
};

/** Closes the pane: the round × in a column, a drawer or a cover; the "‹ Back" button of a pushed page (it pops it).
 *  Either way `onOpenChange` hears `close-press`. With children it shows them instead. */
export function AdaptivePaneClose({ className, children, backLabel = 'Back', 'aria-label': ariaLabel, ...props }: AdaptivePaneCloseProps) {
  const { presentation, titleId } = usePane('AdaptivePaneClose');
  const ownId = useId();
  const id = props.id ?? ownId;
  if (presentation === 'push') {
    return (
      <Close type="button" aria-label={ariaLabel ?? (typeof backLabel === 'string' ? backLabel : 'Back')}
        className={cx(
          ['bl-btn relative z-1 col-start-1 row-start-1 flex min-w-0 cursor-pointer items-center justify-self-start rounded-ctl border-0 bg-transparent py-1.5 pr-2 pl-0 [font-family:inherit] text-body text-primary', focusRing],
          className,
        )}
        {...props}>
        {children ?? (
          <>
            <Icon name="chevL" size={24} sw={2.4} className="shrink-0 rtl:-scale-x-100" />
            <span className="truncate">{backLabel}</span>
          </>
        )}
      </Close>
    );
  }
  return (
    <Close type="button" id={id}
      // "Close Activity": its own label, then the pane's title, when the pane has one.
      aria-label={ariaLabel ?? 'Close'} aria-labelledby={ariaLabel ? undefined : `${id} ${titleId}`}
      className={cx([closeButtonVariants({ layout: 'inline' }), 'ms-auto'], className)}
      {...props}>
      {children ?? <Icon name="x" size={15} sw={2.6} />}
    </Close>
  );
}
