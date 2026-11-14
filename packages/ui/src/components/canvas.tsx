'use client';
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import type { Viewport } from '@ui-sdk/core';
import { usePart, usePrimitive } from '@ui-sdk/react/primitive';
import { useContainerSize } from '@/lib/container';
import { toBoard, toScreen, type Frame, type Guide, type Handle, type Pt, type Rect } from '@/lib/canvas-math';
import { canvas, miniMapLayout, type CanvasController, type CanvasOptions } from '@/lib/canvas-primitive';
import { cn } from '@/lib/utils';

export { createCanvasController } from '@/lib/canvas-primitive';
export type { CanvasController, CanvasFitOptions, CanvasPointerInfo, CanvasViewportChangeDetails, CanvasViewportReason } from '@/lib/canvas-primitive';
export type { Viewport };

/* ══ Canvas — an infinite, pannable, zoomable surface ══
   The canvas owns *navigation*, on UI SDK's viewport (the canvas primitive): scroll pans, pinch or ⌘-scroll zooms, hold
   Space (or use the middle button, or set `panning`) to drag the view, + − 0 and ⌘ + − 0 1 zoom in, out, fit and 100%,
   arrow keys you don't use pan, focus brings a board item into view, find in page pans to its match, and a dotted or
   ruled background follows the view. Everything else is yours: it hands you the pointer with the point already in board
   coordinates, so selection, dragging, drawing and connecting can be one state machine that does not care about the view.

     <Canvas viewport={viewport} onViewportChange={setViewport} onCanvasPointerDown={(e, { board }) => …}>
       {items.map((it) => <Card key={it.id} style={{ left: it.x, top: it.y }} />)}   // board units, scaled by the view
       <CanvasFrame frame={selected} />                                                // selection outline, constant on screen
     </Canvas>

   Children live in the *board layer* (one element moved and scaled by the view); `overlay` is drawn on top in screen
   space (an empty state, a `CanvasMiniMap`). `useCanvas()` gives children the zoom, the conversions and the controller's
   methods; `createCanvasController()` gives them to code outside it (a toolbar's zoom buttons). The overlay parts
   (`CanvasFrame`, `CanvasHandles`, `CanvasMarquee`, `CanvasGuides`) keep their lines the same thickness on screen at any
   zoom. The frame math (`toBoard`, `resizeFrame`, `snapMove` …) is in `@/lib/canvas-math`. */

export interface CanvasProps extends CanvasOptions {
  /** The pattern behind the board (default `dots`). */
  background?: 'dots' | 'grid' | 'none';
  /** The cursor over the canvas when it is not being dragged (`grab` / `grabbing` take over while panning). */
  cursor?: string;
  'aria-label'?: string;
  /** Drawn over the canvas in screen space, not scaled. */
  overlay?: ReactNode;
  /** The board layer: in board units, moved and scaled by the view. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}

export interface CanvasContextValue extends Omit<CanvasController, 'getViewport' | 'toScreen'> {
  viewport: Viewport;
  /** The view's zoom: divide a screen length by it to get board units. */
  zoom: number;
  /** The canvas's size in px. */
  size: { width: number; height: number };
  /** A pointer event's position in the canvas's own pixels. */
  local: (e: { clientX: number; clientY: number }) => Pt;
  /** A pointer event's position in board units. */
  toBoard: (e: { clientX: number; clientY: number }) => Pt;
  /** A board point in the canvas's own pixels (the controller's `toScreen` gives client pixels). */
  toScreen: (p: Pt) => Pt;
}

const CanvasContext = createContext<CanvasContextValue | null>(null);

/** The view, zoom, conversions and view controls of the nearest `<Canvas>`. */
export function useCanvas(): CanvasContextValue {
  const value = useContext(CanvasContext);
  if (!value) throw new Error('useCanvas must be used within <Canvas>');
  return value;
}

export function Canvas({
  viewport, defaultViewport, onViewportChange, panning, fit, minZoom, maxZoom, message, autoFocus,
  onCanvasPointerDown, onCanvasPointerMove, onCanvasPointerUp, onCanvasDoubleClick, onNavigationStart, onCanvasKeyDown, controller,
  background = 'dots', cursor = 'default', 'aria-label': ariaLabel = 'Canvas', overlay, children, className, style,
}: CanvasProps) {
  const handle = usePrimitive(canvas, {
    viewport, defaultViewport, onViewportChange, panning, fit, minZoom, maxZoom, message, autoFocus,
    onCanvasPointerDown, onCanvasPointerMove, onCanvasPointerUp, onCanvasDoubleClick, onNavigationStart, onCanvasKeyDown, controller,
  });
  const { instance, api } = handle;
  // The background, the overlay parts and the minimap follow the view as it moves; the board's transform is live.
  const subscribe = useCallback((listener: () => void) => instance.subscribe(listener), [instance]);
  const read = useCallback(() => instance.get(), [instance]);
  const state = useSyncExternalStore(subscribe, read, read);
  const view = viewport ?? state.viewport;
  const [ref, size] = useContainerSize<HTMLDivElement>({ width: 1000, height: 700 });

  const local = useCallback((e: { clientX: number; clientY: number }): Pt => {
    const r = ref.current?.getBoundingClientRect();
    return { x: e.clientX - (r?.left ?? 0), y: e.clientY - (r?.top ?? 0) };
  }, [ref]);

  const bgStyle = useMemo<CSSProperties>(() => {
    if (background === 'none') return {};
    let step = (background === 'dots' ? 24 : 40) * view.zoom;
    while (step < 12) step *= 2;
    const ink = 'color-mix(in srgb, var(--muted-foreground) 34%, transparent)';
    const pos = `${view.x}px ${view.y}px`;
    return background === 'dots'
      ? { backgroundImage: `radial-gradient(${ink} 1.1px, transparent 1.4px)`, backgroundSize: `${step}px ${step}px`, backgroundPosition: pos }
      : { backgroundImage: `linear-gradient(to right, ${ink} 1px, transparent 1px), linear-gradient(to bottom, ${ink} 1px, transparent 1px)`, backgroundSize: `${step}px ${step}px`, backgroundPosition: pos };
  }, [background, view.x, view.y, view.zoom]);

  const value = useMemo<CanvasContextValue>(() => ({
    viewport: view, zoom: view.zoom, size, local,
    toBoard: (e) => { const s = local(e); return toBoard(view, s.x, s.y); },
    toScreen: (p) => toScreen(view, p), toCanvas: api.toCanvas, visible: api.visible,
    setViewport: api.setViewport, panBy: api.panBy, zoomTo: api.zoomTo, zoomBy: api.zoomBy, fit: api.fit, reveal: api.reveal,
  }), [view, size, local, api]);

  const grab = state.grabbing ? 'grabbing' : state.spaceHeld || panning ? 'grab' : cursor;
  const board = usePart(handle, 'board', {}, { className: 'pointer-events-auto absolute top-0 left-0 text-foreground', children }, 'div');
  const pane = usePart(handle, 'pane', {}, { className: 'pointer-events-none absolute inset-0 touch-none overflow-scroll [scrollbar-width:none]', children: board }, 'div');
  const root = usePart(handle, 'root', {}, {
    ref,
    'aria-label': ariaLabel,
    className: cn('absolute inset-0 touch-none overflow-clip bg-background outline-none select-none focus-visible:outline-none', className),
    style: { ...bgStyle, cursor: grab, ...style },
    children: <>{pane}{overlay}</>,
  }, 'div');
  return <CanvasContext.Provider value={value}>{root}</CanvasContext.Provider>;
}

/* ── Overlay parts: lines and handles that keep their thickness on screen at any zoom ──
   They divide by the board's `--canvas-zoom` (the viewport's live style writes it on the board layer), so a pan or a
   zoom restyles them in CSS and never renders them again. */

/** Screen pixels as board units, under the board's scale. */
const px = (n: number) => `calc(${n}px / var(--canvas-zoom, 1))`;

const HANDLE_PX = 10;

export interface CanvasFrameProps {
  frame: Frame;
  /** A dashed outline (a locked item). */
  dashed?: boolean;
  /** Air between the frame and its outline, in screen px (default 3). */
  offset?: number;
}

/** An outline around a (rotated) frame, in the theme's primary color. Put it in the board layer. */
export function CanvasFrame({ frame, dashed, offset = 3 }: CanvasFrameProps) {
  return (
    <div
      data-slot="canvas-frame"
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute rounded-(--canvas-frame-radius) outline-(length:--canvas-frame-line) outline-offset-(--canvas-frame-offset) outline-primary',
        dashed ? 'outline-dashed' : 'outline-solid',
      )}
      style={{
        left: frame.x, top: frame.y, width: frame.w, height: frame.h,
        transform: frame.rot ? `rotate(${frame.rot}deg)` : undefined,
        '--canvas-frame-line': px(1.6), '--canvas-frame-offset': px(offset), '--canvas-frame-radius': px(2),
      } as CSSProperties}
    />
  );
}

/** Resize and rotate handles (from `frameHandles`, or your own: a connector's ends). Round for `rot`, `from` and `to`. */
export function CanvasHandles({ handles }: { handles: Handle[] }) {
  return (
    <>
      {handles.map((h) => (
        <span
          key={h.id}
          data-slot="canvas-handle"
          data-handle={h.id}
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute size-(--canvas-handle) border-(length:--canvas-handle-line) border-solid border-primary bg-background',
            h.id === 'rot' || h.id === 'from' || h.id === 'to' ? 'rounded-full' : 'rounded-[2px]',
          )}
          style={{ left: `calc(${h.pt.x}px - ${px(HANDLE_PX / 2)})`, top: `calc(${h.pt.y}px - ${px(HANDLE_PX / 2)})`, '--canvas-handle': px(HANDLE_PX), '--canvas-handle-line': px(1.6) } as CSSProperties}
        />
      ))}
    </>
  );
}

/** The rubber band of a drag-select, in board units. */
export function CanvasMarquee({ rect }: { rect: Rect }) {
  return (
    <span
      data-slot="canvas-marquee"
      aria-hidden="true"
      className="pointer-events-none absolute border-(length:--canvas-marquee-line) border-solid border-primary bg-primary/10"
      style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h, '--canvas-marquee-line': px(1) } as CSSProperties}
    />
  );
}

/** Alignment guides (from `snapMove`) drawn as hairlines. */
export function CanvasGuides({ guides }: { guides: Guide[] }) {
  return (
    <>
      {guides.map((g, i) => (
        <span
          key={i}
          data-slot="canvas-guide"
          aria-hidden="true"
          className="pointer-events-none absolute bg-primary"
          // A guide is a line along one axis: at least a screen pixel across.
          style={{ left: g.x1, top: g.y1, width: `max(${g.x2 - g.x1}px, ${px(1)})`, height: `max(${g.y2 - g.y1}px, ${px(1)})` }}
        />
      ))}
    </>
  );
}

/* ── MiniMap: the whole board in a corner, the view outlined; press or drag on it to move the view there ── */

export interface CanvasMiniMapItem extends Rect {
  id?: string;
  /** Fill class for the item's mark (default `fill-muted-foreground/35`); a selected item might be `fill-primary`. */
  className?: string;
}

export interface CanvasMiniMapProps {
  /** What's on the board, in board units: frames, cards, nodes. */
  items: readonly CanvasMiniMapItem[];
  /** Which corner it sits in (default `bottom-right`). */
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  /** Its size in px (default 184 × 120). */
  width?: number;
  height?: number;
  className?: string;
}

const CORNER: Record<NonNullable<CanvasMiniMapProps['position']>, string> = {
  'bottom-right': 'right-3 bottom-3', 'bottom-left': 'bottom-3 left-3', 'top-right': 'top-3 right-3', 'top-left': 'top-3 left-3',
};

/** An overview of the board for `<Canvas overlay>`: every item as a mark and the view as an outline. Pressing or
 *  dragging on it centers the view there, and Escape during a drag puts the view back; the canvas keeps the keyboard
 *  (⌘0 fits, arrows pan). */
export function CanvasMiniMap({ items, position = 'bottom-right', width = 184, height = 120, className }: CanvasMiniMapProps) {
  const { viewport: v, size } = useCanvas();
  // The view in board units, and everything the map has to show: the items and the view.
  const view: Rect = { x: -v.x / v.zoom, y: -v.y / v.zoom, w: size.width / v.zoom, h: size.height / v.zoom };
  const { scale: k, offsetX: ox, offsetY: oy } = miniMapLayout(items, view, width, height);
  return usePart(canvas, 'minimap', { items, width, height }, {
    className: cn('absolute z-10 cursor-pointer overflow-hidden rounded-ctl bg-popover/90 shadow-[0_4px_16px_--alpha(black/14%),0_0_0_.5px_var(--border)] backdrop-blur-md', CORNER[position], className),
    style: { width, height },
    children: (
      <svg width={width} height={height} className="block">
        {items.map((it, i) => (
          <rect key={it.id ?? i} x={ox + it.x * k} y={oy + it.y * k} width={Math.max(1.5, it.w * k)} height={Math.max(1.5, it.h * k)} rx={1.5}
            className={it.className ?? 'fill-muted-foreground/35'} />
        ))}
        <rect data-slot="canvas-minimap-view" x={ox + view.x * k} y={oy + view.y * k} width={view.w * k} height={view.h * k} rx={2}
          className="fill-primary/8 stroke-primary" strokeWidth={1.5} />
      </svg>
    ),
  }, 'div');
}
