'use client';
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { EdgeDrawer, type EdgeDrawerProps } from '@/components/ui/edge-drawer';
import { navigationPush } from '@/components/ui/navigation-stack';
import { useDrawerSwipe } from '@/lib/drawer-swipe';
import { cn } from '@/lib/utils';

/* ══ AdaptivePane — one region, four presentations ══
   mode="column" docks it beside its siblings in a flex row, mode="drawer" moves the same children into an
   EdgeDrawer over the host, mode="cover" fills the positioned host, mode="hidden" renders nothing.
   The host decides the mode from its width; the children never change, so their state survives.

   A column or a drawer can be `resizable`: a divider on the edge it shares with the page drags its width, with
   the keyboard (arrows, Home, End) and by double-click back to the default. A drawer moves like a NavigationStack
   screen: it opens and closes on the `smooth` spring, drags shut by its panel with the stack's commit distance
   and flick, and (when the host gives `onOpen`) drags open from a strip along its edge. */

export type AdaptivePaneMode = 'column' | 'drawer' | 'cover' | 'hidden';

export interface AdaptivePaneProps extends Omit<EdgeDrawerProps, 'open' | 'width'> {
  mode: AdaptivePaneMode;
  /** drawer visibility; ignored in the other modes */
  open?: boolean;
  columnWidth?: number | string;
  drawerWidth?: number | string;
  /** style of the docked column; `style` applies to the drawer panel */
  columnStyle?: CSSProperties;
  /** A divider on the pane's inner edge that resizes the column or the drawer. */
  resizable?: boolean;
  /** Narrowest a resized pane gets, px. Default 160. */
  minWidth?: number;
  /** Called as the pane is resized, with its new width, or `undefined` once it is reset to its default. A numeric
   *  `maxWidth` also caps the resize; a column never takes the last 240px of its host, a drawer the last 48px. */
  onResize?: (width: number | undefined, mode: 'column' | 'drawer') => void;
  /** Drawer: drag the panel toward its edge to close it. Default true. */
  swipe?: boolean;
  /** Drawer: called when a drag from the host's edge opens it; giving it turns that edge strip on. */
  onOpen?: () => void;
  children?: ReactNode;
}

/** Width a resized pane leaves for what is beside it. */
const KEEP = { column: 240, drawer: 48 } as const;
const STEP = 16;

export function AdaptivePane({
  mode, open = false, columnWidth, drawerWidth, columnStyle, side = 'left', resizable = false, minWidth = 160, onResize,
  swipe = true, onOpen, maxWidth, children, ...drawer
}: AdaptivePaneProps) {
  // A width the user dragged to, per presentation; unset until then, so the host's own width applies.
  const [sizes, setSizes] = useState<{ column?: number; drawer?: number }>({});
  const panel = useRef<HTMLDivElement>(null);
  const scrim = useRef<HTMLDivElement>(null);
  const drag = useDrawerSwipe({
    side, open, panel: () => panel.current, scrim: () => scrim.current,
    commit: navigationPush.commit, flick: navigationPush.flick, onOpen, onClose: drawer.onClose,
  });
  const resizer = (m: 'column' | 'drawer') => resizable
    ? <PaneResizer side={side} mode={m} minWidth={minWidth} maxWidth={maxWidth}
        onResize={(w) => { setSizes((s) => ({ ...s, [m]: w })); onResize?.(w, m); }} />
    : null;

  if (mode === 'hidden') return null;
  if (mode === 'cover') {
    return <div data-slot="adaptive-pane" data-mode="cover" className="absolute inset-0" style={{ zIndex: drawer.zIndex }}>{children}</div>;
  }
  if (mode === 'drawer') {
    return (
      <>
        <EdgeDrawer {...drawer} side={side} open={open} maxWidth={maxWidth} width={sizes.drawer ?? drawerWidth}
          panelRef={panel} scrimRef={scrim} panelProps={swipe ? drag.panelProps : undefined}
          className={cn('touch-pan-y duration-spring-smooth ease-spring-smooth', drawer.className)}>
          {children}
          {resizer('drawer')}
        </EdgeDrawer>
        {swipe && onOpen && !open ? (
          <div data-slot="adaptive-pane-edge" aria-hidden="true" {...drag.edgeProps}
            className={cn('absolute inset-y-0 z-(--adaptive-pane-z) w-4 touch-pan-y', side === 'left' ? 'left-0' : 'right-0')}
            style={{ '--adaptive-pane-z': drawer.zIndex ?? 30 } as CSSProperties} />
        ) : null}
      </>
    );
  }
  return (
    <div data-slot="adaptive-pane" data-mode="column" data-side={side} className={cn('min-h-0 shrink-0', resizable && 'relative')}
      style={{ width: sizes.column ?? columnWidth, ...columnStyle }}>
      {children}
      {resizer('column')}
    </div>
  );
}

/** The divider on a pane's inner edge. It measures the pane (its parent) when a drag or key starts, so the host can
 *  give any CSS width and the first resize still begins from what is on screen. */
function PaneResizer({ side, mode, minWidth, maxWidth, onResize }: {
  side: 'left' | 'right';
  mode: 'column' | 'drawer';
  minWidth: number;
  maxWidth?: number | string;
  onResize: (width: number | undefined) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x0: number; w0: number } | null>(null);
  const [now, setNow] = useState<number>();
  const [active, setActive] = useState(false);
  const [hot, setHot] = useState(false);
  const [focused, setFocused] = useState(false);
  // Dragging away from the pane's own edge widens it.
  const grow = side === 'left' ? 1 : -1;
  const pane = () => ref.current?.parentElement ?? null;
  const limits = () => {
    const room = (pane()?.parentElement?.clientWidth ?? Infinity) - KEEP[mode];
    return { min: minWidth, max: Math.max(minWidth, Math.min(typeof maxWidth === 'number' ? maxWidth : Infinity, room)) };
  };
  const width = () => pane()?.getBoundingClientRect().width ?? minWidth;
  const set = (w: number) => {
    const { min, max } = limits();
    const v = Math.round(Math.min(max, Math.max(min, w)));
    setNow(v);
    onResize(v);
  };
  const reset = () => { setNow(undefined); onResize(undefined); };
  const end = () => { drag.current = null; setActive(false); };
  const onKeyDown = (e: KeyboardEvent) => {
    const step = (e.shiftKey ? 3 : 1) * STEP;
    if (e.key === 'ArrowRight') set(width() + grow * step);
    else if (e.key === 'ArrowLeft') set(width() - grow * step);
    else if (e.key === 'Home') set(limits().min);
    else if (e.key === 'End') set(limits().max);
    else if (e.key === 'Enter') reset();
    else return;
    e.preventDefault();
  };
  return (
    <div ref={ref} role="separator" aria-orientation="vertical" aria-label="Resize pane" tabIndex={0}
      data-slot="adaptive-pane-resizer" data-drawer-swipe="off"
      aria-valuenow={now} aria-valuemin={minWidth} aria-valuemax={typeof maxWidth === 'number' ? maxWidth : undefined}
      onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
        if (e.button) return;
        drag.current = { x0: e.clientX, w0: width() };
        setActive(true);
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* no active pointer (synthetic input) */ }
        e.preventDefault();
      }}
      onPointerMove={(e) => { if (drag.current) set(drag.current.w0 + grow * (e.clientX - drag.current.x0)); }}
      onPointerUp={end} onPointerCancel={end}
      onPointerEnter={() => setHot(true)} onPointerLeave={() => setHot(false)}
      onFocus={(e) => setFocused(e.currentTarget.matches(':focus-visible'))} onBlur={() => setFocused(false)}
      onKeyDown={onKeyDown} onDoubleClick={reset}
      className={cn('absolute inset-y-0 z-40 w-[10px] cursor-col-resize touch-none outline-none', side === 'left' ? '-right-[5px]' : '-left-[5px]')}>
      <div className={cn(
        'absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-full bg-primary transition-[opacity,transform] duration-200',
        focused || active || hot ? 'scale-y-100' : 'scale-y-[.96] opacity-0',
        !(focused || active) && hot && 'opacity-45',
      )} />
    </div>
  );
}
