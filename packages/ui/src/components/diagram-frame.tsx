'use client';
import {
  createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ComponentProps, type MouseEvent, type ReactNode, type Ref,
} from 'react';
import {
  AdaptivePane, AdaptivePaneClose, AdaptivePaneHeader, AdaptivePaneTitle, AdaptivePaneTrigger, adaptivePanePageClass, createAdaptivePaneController,
  type AdaptivePaneController, type AdaptivePaneOpenChangeDetails, type AdaptivePanePresentation,
} from '@/components/ui/adaptive-pane';
import { buttonVariants } from '@/components/ui/button';
import { SizeClassProvider, useSizeClass } from '@/lib/container';
import type { SizeClass, SizeClassBreakpoints } from '@/lib/size-class';
import { DiagramChromeProvider, useDiagramChromeInset, useDiagramChromeScope } from '@/lib/diagram-chrome';
import { BackLabel, backName, barBackButton, barTitle, useBackFit } from '@/lib/nav-bar';
import { barSurface, sectionLabelVariants } from '@/lib/primitives';
import { surfaceBodyVariants } from '@/lib/surface';
import { cn } from '@/lib/utils';

/* ══ DiagramFrame — a board with a panel beside it ══
   Anything that is a board and something about it: a machine and its simulation, services and the one selected. The
   frame measures its own size class and is a size-class scope, and the panel is an `AdaptivePane`, so the panel is the
   kit's responsive pattern rather than a layout of its own: a column beside the board when there's the room
   (regular), a drawer over it (medium) that doesn't dim it, so you can watch the board while you use the panel, and a
   page pushed over it on a phone (compact), with a back button to the board. A bar floats over the board with a status
   and the button that opens the panel, whenever the panel's closed.

     <DiagramFrame>
       <DiagramFrameBoard>
         <Diagram … />
         <DiagramFrameBar>{where it is now}</DiagramFrameBar>
       </DiagramFrameBoard>
       <DiagramFramePanel title="Simulation">
         <DiagramFrameSection title="Events it can take">…</DiagramFrameSection>
       </DiagramFramePanel>
     </DiagramFrame>

   A `DiagramFrameCover` goes over all of it (what's inside what's selected), with a `DiagramFrameCoverHeader` that goes
   back, and the board and the panel are inert under it. The panel's fields are the kit's `Field` and `Input` (with
   `onValueCommit` for a field that changes something once you're done with it). Why not SplitView: a split view is navigation between columns of lists; this is one board and its
   inspector, and AdaptivePane is the kit's inspector. */

/** The size classes of a frame: a column needs the board to keep ~440 px beside it. */
const BREAKPOINTS: SizeClassBreakpoints = { medium: 440, regular: 720 };
const PANEL_WIDTH = 288;

interface DiagramFrameContextValue {
  open: boolean;
  /** Opens or closes the panel, through its own change (`onOpenChange` hears it, and can refuse it). */
  setOpen: (open: boolean, options?: { reason?: AdaptivePaneOpenChangeDetails['reason']; event?: Event }) => boolean;
  /** The panel's `onOpenChange`. */
  changed: (open: boolean, details: AdaptivePaneOpenChangeDetails) => void;
  /** How the panel shows now. */
  presentation: Exclude<AdaptivePanePresentation, 'auto'>;
  sizeClass: SizeClass;
  side: 'start' | 'end';
  controller: AdaptivePaneController;
  covered: boolean;
  /** The panel's title, for the trigger's default text. */
  title: ReactNode;
  setTitle: (title: ReactNode) => void;
  setCovered: (covered: boolean) => void;
  /** Focus goes into the panel when the trigger opens it as a column, and back to the trigger when it closes. */
  moved: { current: boolean };
}

const DiagramFrameContext = createContext<DiagramFrameContextValue | null>(null);

function useFrame(part: string): DiagramFrameContextValue {
  const value = useContext(DiagramFrameContext);
  if (!value) throw new Error(`<${part}> must be used inside <DiagramFrame>.`);
  return value;
}

/** Whether the panel's open, how it shows, the frame's size class, and whether a cover is over it (the board and the
 *  panel are inert while it is): for a part of your own inside the frame. */
export function useDiagramFrame(): Pick<DiagramFrameContextValue, 'open' | 'setOpen' | 'presentation' | 'sizeClass' | 'covered'> {
  const { open, setOpen, presentation, sizeClass, covered } = useFrame('useDiagramFrame');
  return { open, setOpen, presentation, sizeClass, covered };
}

const resolve = (presentation: AdaptivePanePresentation, side: 'start' | 'end', sizeClass: SizeClass): Exclude<AdaptivePanePresentation, 'auto'> => {
  if (presentation !== 'auto') return presentation;
  if (sizeClass === 'compact') return side === 'end' ? 'push' : 'drawer';
  return sizeClass === 'medium' ? 'drawer' : 'column';
};

export interface DiagramFrameProps extends Omit<ComponentProps<'div'>, 'ref'> {
  /** Whether the panel shows, to control it. */
  open?: boolean;
  /** Whether it shows at first. Default: when it's a column, and not when it would go over the board. */
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean, details: AdaptivePaneOpenChangeDetails) => void;
  /** How the panel shows. Default `auto`: a column at regular, a drawer at medium, a pushed page at compact (an `end`
   *  panel; a drawer for a `start` one). */
  presentation?: AdaptivePanePresentation;
  /** The edge the panel is on (default `end`). */
  side?: 'start' | 'end';
  /** The widths, px, the frame's medium and regular size classes start at. Default 440 and 720. */
  breakpoints?: SizeClassBreakpoints;
  ref?: Ref<HTMLDivElement>;
}

/** The frame: a board and its panel, filling the nearest positioned box. */
export function DiagramFrame({ open: openProp, defaultOpen, onOpenChange, presentation = 'auto', side = 'end', breakpoints = BREAKPOINTS, className, children, ref, ...props }: DiagramFrameProps) {
  const [measure, sizeClass] = useSizeClass<HTMLDivElement>({ breakpoints });
  const rootRef = useCallback((el: HTMLDivElement | null) => {
    measure(el);
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  }, [measure, ref]);
  const shown = resolve(presentation, side, sizeClass);
  const [controller] = useState(createAdaptivePaneController);
  // `null` until it's chosen: until then it follows the presentation, open as a column and closed over the board.
  const [choice, setChoice] = useState<boolean | null>(defaultOpen ?? null);
  // A choice is for the way the panel shows when it was made: closing a pushed page is going back to the board, not
  // hiding the inspector, so when the frame widens into a column, the column shows again (as an iPad's split view does).
  const [chosenFor, setChosenFor] = useState(shown);
  if (chosenFor !== shown) {
    setChosenFor(shown);
    if (choice !== null) setChoice(null);
  }
  const open = openProp ?? choice ?? shown === 'column';
  const [title, setTitle] = useState<ReactNode>('Details');
  const [covered, setCovered] = useState(false);
  const moved = useRef(false);
  const setOpen = useCallback<DiagramFrameContextValue['setOpen']>((next, options) => controller.setOpen(next, options), [controller]);
  const changed = useCallback<DiagramFrameContextValue['changed']>((next, details) => {
    moved.current = true;
    onOpenChange?.(next, details);
    if (!details.canceled && openProp === undefined) setChoice(next);
  }, [onOpenChange, openProp]);
  const value = useMemo<DiagramFrameContextValue>(() => ({
    open, setOpen, changed, presentation: shown, sizeClass, side, controller, covered, title, setTitle, setCovered, moved,
  }), [open, setOpen, changed, shown, sizeClass, side, controller, covered, title]);
  return (
    <DiagramFrameContext.Provider value={value}>
      <SizeClassProvider value={sizeClass}>
        <div
          ref={rootRef}
          data-slot="diagram-frame"
          data-presentation={shown}
          data-size-class={sizeClass}
          data-open={open ? '' : undefined}
          data-covered={covered ? '' : undefined}
          className={cn('absolute inset-0 flex overflow-hidden bg-background', side === 'start' && 'flex-row-reverse', className)}
          {...props}
        >
          {children}
        </div>
      </SizeClassProvider>
    </DiagramFrameContext.Provider>
  );
}

export type DiagramFrameBoardProps = ComponentProps<'div'>;

/** The board's box: put a `Diagram` (and a `DiagramFrameBar`) in it. It's the page a pushed panel slides over, and
 *  it's inert under a cover. Its `ref` is a good `host` to measure a layout's text in. A Diagram in it fits its content
 *  clear of the bar, and puts its toolbar at the top. */
export function DiagramFrameBoard({ className, children, ref: refProp, ...props }: DiagramFrameBoardProps) {
  const { covered } = useFrame('DiagramFrameBoard');
  const own = useRef<HTMLDivElement | null>(null);
  const ref = useCallback((el: HTMLDivElement | null) => {
    own.current = el;
    if (typeof refProp === 'function') refProp(el);
    else if (refProp) refProp.current = el;
  }, [refProp]);
  const chrome = useDiagramChromeScope(own, { frame: true });
  return (
    <div ref={ref} data-slot="diagram-frame-board" inert={covered || undefined} className={cn('relative min-h-0 min-w-0 flex-1', adaptivePanePageClass, className)} {...props}>
      <DiagramChromeProvider value={chrome}>{children}</DiagramChromeProvider>
    </div>
  );
}

export type DiagramFrameTriggerProps = Omit<ComponentProps<typeof AdaptivePaneTrigger>, 'controller'>;

/** The button that opens the panel (and closes it, where it's a column). Its text is the panel's title unless you give
 *  it children; `render` puts it in a toolbar of your own. */
export function DiagramFrameTrigger({ className, children, onClick, ...props }: DiagramFrameTriggerProps) {
  const { controller, title, moved } = useFrame('DiagramFrameTrigger');
  return (
    <AdaptivePaneTrigger
      data-diagram-frame-trigger=""
      controller={controller}
      className={typeof className === 'function' ? className : cn(buttonVariants({ variant: 'secondary', size: 'sm' }), className)}
      onClick={(event) => {
        moved.current = true;
        onClick?.(event);
      }}
      {...props}
    >
      {children ?? title}
    </AdaptivePaneTrigger>
  );
}

export interface DiagramFrameBarProps extends ComponentProps<'div'> {
  /** What opens the panel. Default a `DiagramFrameTrigger`; `null` for none. */
  trigger?: ReactNode;
}

/** A bar floating at the foot of the board, while the panel's closed: a status (its children, read politely as it
 *  changes) and the button that opens the panel. */
export function DiagramFrameBar({ trigger, className, children, ...props }: DiagramFrameBarProps) {
  const { open, moved } = useFrame('DiagramFrameBar');
  const bar = useRef<HTMLDivElement>(null);
  // A fit leaves room for it while it shows.
  useDiagramChromeInset(bar, 'bottom', !open);
  // The panel closed from inside it (its × or back): focus comes back to the button that opens it.
  useEffect(() => {
    if (open || !moved.current) return;
    moved.current = false;
    bar.current?.querySelector<HTMLElement>('[data-diagram-frame-trigger]')?.focus({ preventScroll: true });
  }, [open, moved]);
  if (open) return null;
  return (
    <div
      ref={bar}
      data-slot="diagram-frame-bar"
      className={cn('absolute inset-x-3 bottom-3 z-10 flex items-center justify-between gap-2 rounded-ctl bg-popover p-2 ps-3 text-footnote text-popover-foreground shadow-raised', className)}
      {...props}
    >
      <span data-slot="diagram-frame-status" role="status" className="min-w-0 truncate font-semibold">{children}</span>
      {trigger === undefined ? <DiagramFrameTrigger /> : trigger}
    </div>
  );
}

export interface DiagramFramePanelProps extends Omit<ComponentProps<'div'>, 'title' | 'children'> {
  /** Heads the panel and names it (give it an `aria-label` too when it isn't text); the trigger's text by default. */
  title: ReactNode;
  /** What the back button says in a pushed panel (default `Board`). */
  backLabel?: string;
  /** Its width as a column (default 288). */
  width?: number;
  /** Whether a drawer dims and blocks the board. Default false: you can watch the board, and press on it, while it's open. */
  modal?: boolean;
  /** Things to do, after the title: a ToolbarButton, a menu. */
  actions?: ReactNode;
  className?: string;
  children?: ReactNode;
}

/** The panel: an AdaptivePane with a header (its title, and × or ‹ back), and a body that scrolls. Its `ref`, `id` and
 *  `data-*` go to the panel's element (`data-slot="diagram-frame-panel"`, around the pane), and `aria-label` names the
 *  pane. */
export function DiagramFramePanel({ title, backLabel = 'Board', width = PANEL_WIDTH, modal = false, actions, className, children, 'aria-label': ariaLabel, ...props }: DiagramFramePanelProps) {
  const { open, changed, presentation, side, controller, covered, setTitle, moved } = useFrame('DiagramFramePanel');
  useLayoutEffect(() => { setTitle(title); }, [title, setTitle]);
  const body = useRef<HTMLDivElement>(null);
  const bodyId = useId();
  // Opened by its trigger as a column, focus goes in: the trigger's gone (the bar hides). A drawer and a push move it themselves.
  useEffect(() => {
    if (!open || presentation !== 'column' || !moved.current) return;
    moved.current = false;
    body.current?.focus({ preventScroll: true });
  }, [open, presentation, moved]);
  return (
    <div data-slot="diagram-frame-panel" className="contents" inert={covered || undefined} {...props}>
      <AdaptivePane
        controller={controller}
        presentation={presentation}
        side={side}
        open={open}
        onOpenChange={changed}
        columnWidth={width}
        drawerWidth={Math.max(width, 300)}
        modal={modal}
        aria-label={ariaLabel}
        className={({ presentation: p }) => cn('bg-background', p === 'column' && (side === 'end' ? 'border-s border-border' : 'border-e border-border'), className)}
      >
        <AdaptivePaneHeader>
          <AdaptivePaneTitle>{title}</AdaptivePaneTitle>
          <div className="flex items-center gap-1">
            {actions}
            <AdaptivePaneClose backLabel={backLabel} />
          </div>
        </AdaptivePaneHeader>
        <div
          ref={body}
          id={bodyId}
          data-slot="diagram-frame-panel-body"
          tabIndex={-1}
          // The body's edges line up with the header's title (the surface's inline padding).
          className={cn(surfaceBodyVariants(), 'flex touch-pan-y flex-col gap-3.5 pt-1 pb-3.5 text-body outline-none')}
        >
          {children}
        </div>
      </AdaptivePane>
    </div>
  );
}

export interface DiagramFrameCoverProps extends ComponentProps<'div'> {
  children?: ReactNode;
}

/** Over the whole frame: something to see in place of the board, like what's inside what's selected. The board and the
 *  panel stay as they are underneath, inert. Render it while it shows, with a `DiagramFrameCoverHeader` to go back. */
export function DiagramFrameCover({ className, children, ...props }: DiagramFrameCoverProps) {
  const { setCovered } = useFrame('DiagramFrameCover');
  useLayoutEffect(() => {
    setCovered(true);
    return () => setCovered(false);
  }, [setCovered]);
  return (
    <div data-slot="diagram-frame-cover" className={cn('absolute inset-0 z-40 flex flex-col bg-background', className)} {...props}>
      {children}
    </div>
  );
}

export interface DiagramFrameCoverHeaderProps extends Omit<ComponentProps<'div'>, 'title'> {
  /** What the cover shows, centered in the bar. */
  title: ReactNode;
  /** What going back goes back to, beside the chevron while it fits (default `Back`). The button is named "Back to" it. */
  backLabel?: string;
  /** Goes back: unmount the cover. */
  onBack: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Things to do, at the end of the bar. */
  actions?: ReactNode;
}

/** A cover's bar: "‹ back" at the start and a centered title, the same bar as a pushed panel's. Its back button takes
 *  focus when the cover opens, so the keys go on from there. */
export function DiagramFrameCoverHeader({ title, backLabel = 'Back', onBack, actions, className, children, ...props }: DiagramFrameCoverHeaderProps) {
  useFrame('DiagramFrameCoverHeader');
  const row = useRef<HTMLDivElement>(null);
  const back = useRef<HTMLButtonElement>(null);
  const fit = useBackFit(row, backLabel, () => row.current?.querySelector<HTMLElement>('[data-slot=diagram-frame-cover-title]'));
  useEffect(() => { back.current?.focus({ preventScroll: true }); }, []);
  return (
    <div data-slot="diagram-frame-cover-header" className={cn('relative box-border flex shrink-0 items-center px-1.5', className)} {...props}>
      <div data-side="top" aria-hidden="true" className={cn(barSurface, 'absolute inset-0 h-auto')} />
      <div ref={row} className="relative flex h-toolbar w-full items-center justify-between gap-2">
        <div className="relative z-1 flex min-w-[44px] items-center">
          <button ref={back} type="button" data-slot="diagram-frame-cover-back" aria-label={backName(backLabel)} className={barBackButton} onClick={onBack}>
            <BackLabel fit={fit} label={backLabel} />
          </button>
          {fit.rulers}
        </div>
        <h2 data-slot="diagram-frame-cover-title" className={cn('m-0 leading-[22px]', barTitle)}>{title}</h2>
        <div className="relative z-1 flex items-center gap-1">{actions}</div>
        {children}
      </div>
    </div>
  );
}

export interface DiagramFrameSectionProps extends Omit<ComponentProps<'section'>, 'title'> {
  title: ReactNode;
}

/** A titled part of a panel: a region named by its title. */
export function DiagramFrameSection({ title, className, children, ...props }: DiagramFrameSectionProps) {
  const id = useId();
  return (
    <section data-slot="diagram-frame-section" aria-labelledby={id} className={cn('flex flex-col gap-1.5', className)} {...props}>
      <h3 id={id} className={sectionLabelVariants({ variant: 'grouped' })}>{title}</h3>
      {children}
    </section>
  );
}
